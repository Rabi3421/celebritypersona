// Entirely synthetic; no URL in this fixture should be fetched.
export function researchFixture() {
  const verified = (value, sourceIds = ["S1"]) => ({ value, status: "verified", sourceIds, note: "Synthetic test evidence only" });
  const unknown = () => ({ value: null, status: "unknown", sourceIds: [], note: "Not available" });
  return {
    schema: "cp-outfit-research/1",
    inputs: { instagramUrl: "https://www.instagram.com/p/SYNTHETIC_ONLY/", productUrl: "https://retailer.example/products/synthetic-navy-saree" },
    researchedAt: "2026-11-14",
    sources: [
      { id: "S1", url: "https://www.instagram.com/p/SYNTHETIC_ONLY/", accessedAt: "2026-11-14", title: "Synthetic caption fixture", quote: "Test Person at the Synthetic Gala on 2026-11-13, wearing Example Label." },
      { id: "S2", url: "https://retailer.example/products/synthetic-navy-saree", accessedAt: "2026-11-14", title: "Synthetic product fixture", quote: "Example Label navy silk saree, INR 12000, in stock. Exact product credited in the synthetic caption." },
    ],
    claims: {
      celebrity: verified("Test Person"), instagramPostDate: verified("2026-11-14"), outfitDate: verified("2026-11-13"),
      event: verified("Synthetic Gala"), occasion: verified("Party"), brand: verified("Example Label", ["S2"]), retailer: verified("Example Retailer", ["S2"]),
      productName: verified("Navy silk saree", ["S2"]), category: verified("saree", ["S2"]), colours: verified("navy", ["S2"]), fabric: verified("Silk", ["S2"]),
      productDescription: verified("Navy silk saree", ["S2"]), price: verified("12000", ["S2"]), currency: verified("INR", ["S2"]),
      availability: verified("in_stock", ["S2"]), productMatch: verified("exact", ["S1", "S2"]), photoCredit: unknown(),
    },
    seo: { keywords: [{ keyword: "test person navy silk saree", role: "primary", rationale: "Identifies the synthetic fixture precisely", demand: "unknown" }], searchIntent: "identify-outfit", title: "Test Person navy silk saree", description: "Test Person wore a navy silk saree by Example Label to the Synthetic Gala. Review the original product details and confirmed INR price.", slug: "test-person-navy-silk-saree", notes: ["Test Person wore a navy silk saree by Example Label to the Synthetic Gala. This is synthetic test content."], identification: "Synthetic caption and product fixture explicitly identify the original.", faqs: [{ question: "What is the synthetic saree made of?", answer: "The synthetic retailer fixture lists silk." }], imageAlts: ["Test Person wearing a navy silk saree"], internalLinks: [] },
    missing: ["Upload and inspect images; confirm photo credit."], warnings: ["Synthetic example only. Keyword demand is unknown."]
  };
}
export function emptyDraft() {
  return { celebrity: "", event: "", occasion: "", occasions: "", date: "", slug: "", seoTitle: "", seoDescription: "", photoCredit: "", images: [], notes: "", items: [], status: "draft", primaryKeyword: "", secondaryKeywords: "", faqs: [], leadPiece: "" };
}
