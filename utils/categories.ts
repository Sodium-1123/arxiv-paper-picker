// utils/categories.ts
export interface CategoryConfig {
  id: string;
  name: string;
  arxivCode: string; // arXivの検索キーワード
}

export const ARXIV_CATEGORIES: CategoryConfig[] = [
  { id: "astro-ph", name: "Astrophysics", arxivCode: "astro-ph" },
  { id: "cond-mat", name: "Condensed Matter", arxivCode: "cond-mat" },
  {
    id: "gr-qc",
    name: "General Relativity and Quantum Cosmology",
    arxivCode: "gr-qc",
  },
  {
    id: "hep-ex",
    name: "High Energy Physics - Experiment",
    arxivCode: "hep-ex",
  },
  {
    id: "hep-lat",
    name: "High Energy Physics - Lattice",
    arxivCode: "hep-lat",
  },
  {
    id: "hep-ph",
    name: "High Energy Physics - Phenomenology",
    arxivCode: "hep-ph",
  },
  { id: "hep-th", name: "High Energy Physics - Theory", arxivCode: "hep-th" },
  { id: "math-ph", name: "Mathematical Physics", arxivCode: "math-ph" },
  { id: "nlin", name: "Nonlinear Sciences", arxivCode: "nlin" },
  { id: "nucl-ex", name: "Nuclear Experiment", arxivCode: "nucl-ex" },
  { id: "nucl-th", name: "Nuclear Theory", arxivCode: "nucl-th" },
  { id: "physics", name: "Physics (General/Applied)", arxivCode: "physics" },
  { id: "quant-ph", name: "Quantum Physics", arxivCode: "quant-ph" },
];
