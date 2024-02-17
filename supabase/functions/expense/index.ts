import { createClient, SupabaseClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../shared/cors.ts";

interface IExpense {
  id?: number;
  expense_name: string;
  expense_desc: string | null;
  expense_amount: number;
  expense_emoji: string;
  expense_ts: Date;
  user_id: string;
  group_id: string | null;
  created_at: Date;
}

async function createExpense(
  supabaseClient: SupabaseClient,
  expense: IExpense,
) {
  const { error } = await supabaseClient.from("expenses").insert(expense);
  if (error) throw error;

  return new Response(null, {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 201,
  });
}

async function getExpenses(
  supabaseClient: SupabaseClient,
  specificDate: string | null,
  fromDate: string | null,
  toDate: string | null,
) {
  if (specificDate) {
    const [month, day, year] = specificDate.split("-");
    const formattedDate = `${year}-${month}-${day}`;
    const startDate = new Date(`${formattedDate}T00:00:00`);
    const endDate = new Date(`${formattedDate}T23:59:59`);

    const { data, error } = await supabaseClient.from("expenses").select("*")
      .gte("expense_ts", startDate.toLocaleString("en-US", { timeZone: "UTC" }))
      .lte(
        "expense_ts",
        endDate.toLocaleString("en-US", { timeZone: "UTC" }),
      );
    if (error) throw error;

    const totalExpenseAmount = data.reduce(
      (total: number, expense: IExpense) => {
        return total + expense.expense_amount;
      },
      0,
    );

    return new Response(
      JSON.stringify({ total_amount: totalExpenseAmount, expenses: data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }

  if (fromDate && toDate) {
    // TODO: Add support for date range
    return new Response(
      JSON.stringify({ "fromDate": fromDate, "toDate": toDate }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
  return new Response(
    JSON.stringify({
      error: "Please provide a specific date or a date range.",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    },
  );
}

Deno.serve(async (req) => {
  const { url, method } = req;

  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const expensePattern = new URLPattern({ pathname: "/expense/:id" });
    const matchingPath = expensePattern.exec(url);
    // deno-lint-ignore no-unused-vars
    const id = matchingPath ? matchingPath.pathname.groups.id : null;
    const urlSearchParams = new URL(url).searchParams;

    let expense = null;
    const specificDate = urlSearchParams.get("specificDate") || null;
    const fromDate = urlSearchParams.get("fromDate") || null;
    const toDate = urlSearchParams.get("toDate") || null;

    if (method === "POST" || method === "PUT") {
      const body = await req.json();
      expense = body.expense;
    }

    /*
     * TODO: Add PUT, DELETE cases
     */

    switch (true) {
      case method === "GET":
        return getExpenses(supabase, specificDate, fromDate, toDate);
      // case id && method === "PUT":
      //   console.log("PUT /expense/:id");
      //   break;
      // case id && method === "DELETE":
      //   console.log("DELETE /expense/:id");
      //   break;
      case method === "POST":
        return createExpense(supabase, expense);
      // case method === "GET":
      //   console.log("GET /expense");
      //   break;
      default:
        return createExpense(supabase, expense);
    }
  } catch {
    return new Response(
      JSON.stringify("Oops! Grab a cup of coffee and give it a few minutes."),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/expense' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
