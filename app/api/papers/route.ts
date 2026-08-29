// app/api/papers/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ARXIV_SOURCE_ID = "s4306400194";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      totalCount = 10,
      minCitations = 0,
      weights = {},
    } = await request.json();

    const activeCategories = Object.keys(weights).filter(
      (cat) => weights[cat] > 0,
    );
    const totalWeight = activeCategories.reduce(
      (sum, cat) => sum + weights[cat],
      0,
    );

    if (totalWeight === 0) {
      return NextResponse.json(
        { error: "比重（%）が指定されていません" },
        { status: 400 },
      );
    }

    // 1. 指定件数（totalCount）ぶん、重みに応じたルーレット抽選で分野ごとに割り振る
    const targetCounts: { [key: string]: number } = {};
    for (let i = 0; i < totalCount; i++) {
      let randomVal = Math.random() * totalWeight;
      for (const cat of activeCategories) {
        if (randomVal < weights[cat]) {
          targetCounts[cat] = (targetCounts[cat] || 0) + 1;
          break;
        }
        randomVal -= weights[cat];
      }
    }

    // 2. 抽選された分野ごとにデータ取得
    let combinedPapers: any[] = [];

    for (const cat of Object.keys(targetCounts)) {
      const neededCount = targetCounts[cat];

      const url = `https://api.openalex.org/works?filter=locations.source.id:${ARXIV_SOURCE_ID},cited_by_count:>${minCitations}&search=${cat}&per_page=25`;

      const res = await fetch(url);
      const data = await res.json();
      const fetchedResults = data.results || [];

      const shuffled = fetchedResults.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, neededCount).map((item: any) => ({
        arxiv_id: item.ids?.arxiv
          ? item.ids.arxiv.replace("https://arxiv.org/abs/", "")
          : item.id,
        title: item.title,
        authors: item.authorships?.map((a: any) => a.author.display_name) || [],
        abstract: item.abstract_inverted_index
          ? "Abstract available on arXiv"
          : "",
        citation_count: item.cited_by_count,
        categories: [cat],
        url: item.ids?.arxiv || item.doi || item.id,
      }));

      combinedPapers = [...combinedPapers, ...selected];
    }

    // 全体をランダムにシャッフル
    const finalResult = combinedPapers.sort(() => 0.5 - Math.random());

    return NextResponse.json({ papers: finalResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
