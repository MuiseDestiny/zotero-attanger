const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");

const bundled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../src/modules/attachmentMatching.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  logLevel: "silent",
});
const compiled = { exports: {} };
new Function("module", "exports", "require", bundled.outputFiles[0].text)(
  compiled,
  compiled.exports,
  require,
);
const {
  ATTACHMENT_MATCH_AMBIGUITY_MARGIN,
  MIN_ATTACHMENT_MATCH_SCORE,
  getPDFDocumentRole,
  getPDFPrimaryDOIs,
  getPDFTitleCandidates,
  normalizeDOI,
  normalizeMatchTitle,
  scoreAttachmentMatch,
} = compiled.exports;

function page(lines) {
  return [
    [
      [
        [
          [
            null,
            null,
            null,
            null,
            lines.map(([text, size = 24]) => [[[0, 0, 0, 0, size, 0, text]]]),
          ],
        ],
      ],
    ],
  ];
}

function nativeWord(
  text,
  {
    font = 24,
    x = 72,
    y = 100,
    after = false,
    bold = true,
    baseline = y + font,
  } = {},
) {
  return [
    x,
    y,
    x + Math.max(1, text.length) * font * 0.45,
    y + font,
    font,
    after ? 1 : 0,
    baseline,
    0,
    0,
    bold ? 1 : 0,
    0,
    0,
    0,
    text,
  ];
}

function nativeLine(text, { font = 24, y = 100, bold = true } = {}) {
  let x = 72;
  return [
    text.split(" ").map((word, index, words) => {
      const value = nativeWord(word, {
        font,
        y,
        bold,
        x,
        after: index < words.length - 1,
      });
      x = value[2] + font * 0.25;
      return value;
    }),
  ];
}

function nativePage(lines) {
  return [612, 792, [[[[0, 0, 0, 0, lines]]]]];
}

function nativeBody() {
  return Array.from({ length: 10 }, (_, index) =>
    nativeLine("Ordinary body text has smaller type than the title.", {
      font: 10,
      y: 300 + index * 12,
      bold: false,
    }),
  );
}

function accepts(title, filename, pdfTitles = []) {
  const score = scoreAttachmentMatch(title, filename, pdfTitles);
  assert.ok(
    score >= MIN_ATTACHMENT_MATCH_SCORE,
    `Expected a match, got ${score}`,
  );
  return score;
}

function rejects(title, filename, pdfTitles = []) {
  const score = scoreAttachmentMatch(title, filename, pdfTitles);
  assert.ok(
    score < MIN_ATTACHMENT_MATCH_SCORE,
    `Expected no match, got ${score}`,
  );
}

test("normalization handles HTML, accents, ligatures and scientific digits", () => {
  assert.equal(
    normalizeMatchTitle(
      "<i>Caf\u00e9</i>: e\u0301\ufb03cient \u0153uvres &amp; Fe\u2082O\u2083",
    ),
    "cafe efficient oeuvres and fe2o3",
  );
  assert.equal(
    normalizeMatchTitle("\u4e2d \u6587 \u6807 \u9898"),
    "\u4e2d\u6587\u6807\u9898",
  );
  assert.equal(normalizeMatchTitle("Study (1)"), "study 1");
  assert.notEqual(
    normalizeMatchTitle("Study 1.5"),
    normalizeMatchTitle("Study 15"),
  );
  assert.equal(
    normalizeMatchTitle("Fe<sub>2</sub>O<sub>3</sub>"),
    normalizeMatchTitle("Fe\u2082O\u2083"),
  );
  assert.equal(normalizeMatchTitle("Caf&eacute; reaction"), "cafe reaction");
});

test("whole-title exact matches work for short Latin and CJK titles", () => {
  for (const title of [
    "A",
    "Shared",
    "\u4e2d\u6587\u6807\u9898",
    "\u30bf\u30a4\u30c8\u30eb",
    "\ud55c\uae00\uc81c\ubaa9",
  ]) {
    assert.equal(scoreAttachmentMatch(title, `${title}.pdf`, []), 1);
    accepts(title, "download.pdf", [title]);
  }
  rejects("A", "A comprehensive review of carbon electrodes.pdf");
  rejects("Shared", "Shared molecular pathways in metabolic disease.pdf");
  rejects("Study of", "Study of nickel hexacyanoferrate electrodes.pdf");
});

const electrochemistryTitle =
  "High Performance Capacitive Deionization Cathode of Nickel Hexacyanoferrate Doped with Copper";

test("complete long titles survive journal, year and author filename prefixes", () => {
  accepts(
    electrochemistryTitle,
    `Angewandte Chemie - 2025 - Wang - ${electrochemistryTitle} (1).pdf`,
  );
  accepts(
    electrochemistryTitle,
    `Wang_2025_${electrochemistryTitle.replace(/ /g, "_")}.pdf`,
  );
  accepts("Report.2026.final", "Report.2026.final.pdf");
});

test("browser download suffixes are not removed from article metadata or item titles", () => {
  accepts(
    "A molecular study of catalyst 2",
    "A molecular study of catalyst 2 (1).pdf",
  );
  rejects(
    "A molecular study of catalyst 2",
    "A molecular study of catalyst 1.pdf",
  );
  rejects("A molecular study of catalyst 2", "download.pdf", [
    "A molecular study of catalyst (1)",
  ]);
  rejects(
    "A molecular study of catalyst 2",
    "A molecular study of catalyst (1).pdf",
  );
  accepts(
    "A molecular study of catalyst (1)",
    "A molecular study of catalyst (1).pdf",
  );
  accepts(
    "A molecular study of catalyst (1)",
    "A molecular study of catalyst (1) (2).pdf",
  );
  rejects(electrochemistryTitle, `Part 2 - ${electrochemistryTitle}.pdf`);
  rejects(electrochemistryTitle, `Electrode 2 - ${electrochemistryTitle}.pdf`);
});

test("same-field and nearly identical articles are not forced into a match", () => {
  rejects(
    electrochemistryTitle,
    electrochemistryTitle.replace("Copper", "Cobalt") + ".pdf",
  );
  rejects(
    electrochemistryTitle,
    "Nickel Hexacyanoferrate as a Novel Anode for Sodium Ion Batteries.pdf",
  );
  rejects(
    "Deep learning for accurate prediction of protein structures",
    "Deep learning for accurate prediction of protein functions.pdf",
  );
  rejects(
    "Deep learning for accurate prediction of protein structures",
    "Accurate prediction of protein structures using deep learning.pdf",
  );
  rejects(
    "A comprehensive study of quantum transport in graphene nanoribbons",
    "A comprehensive study of optical transport in graphene nanoribbons.pdf",
  );
  rejects(
    "Advanced microscopy techniques for studying intracellular transport",
    "Advanced macroscopy techniques for studying intracellular transport.pdf",
  );
  rejects(
    "Microbiology approaches to understanding soil ecosystem processes",
    "Macrobiology approaches to understanding soil ecosystem processes.pdf",
  );
  const longTitle =
    "A detailed comprehensive experimental characterization of robust scalable nanostructured catalytic electrodes incorporating transition metal atoms and oxygen vacancies for selective electrochemical reduction of carbon dioxide under industrial reaction conditions";
  rejects(longTitle, longTitle.replace("oxygen", "carbon") + ".pdf");
});

test("unrelated PDFs stay unmatched regardless of filename length", () => {
  rejects(
    electrochemistryTitle,
    "The history of French theatre in the nineteenth century.pdf",
  );
  rejects(electrochemistryTitle, "download.pdf", [
    "Untitled",
    "Microsoft Word",
    "Microsoft Word - draft.docx",
  ]);
  rejects(
    "Attention Is All You Need",
    "Attention mechanisms for medical image segmentation.pdf",
  );
});

test("scientific numbers, formulae and negations remain decisive", () => {
  rejects(
    "A study of CO2 reduction on Fe2O3 electrodes",
    "A study of CO2 reduction on Fe2O4 electrodes.pdf",
  );
  rejects(
    "IL-6 signaling in the progression of liver fibrosis",
    "IL-17 signaling in the progression of liver fibrosis.pdf",
  );
  rejects(
    "A randomized trial of 50 mg aspirin in cardiac disease",
    "A randomized trial of 100 mg aspirin in cardiac disease.pdf",
  );
  rejects(
    "Deep learning does not improve clinical outcome prediction",
    "Deep learning does improve clinical outcome prediction.pdf",
  );
  rejects(
    "Protein folding without molecular chaperones",
    "Protein folding with molecular chaperones.pdf",
  );
  rejects(
    "A positive association between inflammation and cancer risk",
    "A negative association between inflammation and cancer risk.pdf",
  );
  rejects(
    "Non-linear modeling of population dynamics under resource limitations",
    "Linear modeling of population dynamics under resource limitations.pdf",
  );
});

test("light formatting, line wrapping and known OCR glyph confusions can match", () => {
  accepts(
    "Efficient photocatalytic conversion of carbon dioxide",
    "Efficient photo-\ncatalytic conversion of carbon dioxide.pdf",
  );
  accepts(
    "High-performance electrodes for capacitive deionization",
    "High performance electrodes for capacitive deionization.pdf",
  );
  accepts(
    "Characterization of nanostructured nickel electrodes",
    "Characterisation of nanostructured nickel electrodes.pdf",
  );
  accepts(
    "The characterization of nanostructured nickel electrodes",
    "Characterization of nanostructured nickel electrodes.pdf",
  );
  accepts(
    "Characterization of nanostructured molecular electrodes",
    "Characterization of nanostructured rnolecular electrodes.pdf",
  );
});

test("a bad PDF title cannot overwrite a precise filename match", () => {
  accepts(electrochemistryTitle, `${electrochemistryTitle}.pdf`, [
    "Microsoft Word - Untitled",
    "Supplementary Information",
    "Journal of Chemistry",
  ]);
  accepts(electrochemistryTitle, "download.pdf", [
    "Untitled",
    electrochemistryTitle,
    "Appendix",
  ]);
});

test("commentaries, corrections and extra scientific qualifiers are not the main article", () => {
  rejects(electrochemistryTitle, `Comment on - ${electrochemistryTitle}.pdf`);
  rejects(electrochemistryTitle, `Correction - ${electrochemistryTitle}.pdf`);
  rejects(
    electrochemistryTitle,
    `${electrochemistryTitle} Supplementary Information.pdf`,
  );
  rejects(electrochemistryTitle, `download.pdf`, [
    `${electrochemistryTitle} without external energy`,
  ]);
});

test("metadata and text title candidates are both retained", () => {
  const candidates = getPDFTitleCandidates({
    metadata: { title: "A misleading journal title" },
    pages: [page([[electrochemistryTitle]])],
  });
  assert.deepEqual(candidates, [
    "A misleading journal title",
    electrochemistryTitle,
  ]);
  accepts(electrochemistryTitle, "download.pdf", candidates);
});

test("metadata survives throwing pages and metadata title getters", () => {
  assert.deepEqual(
    getPDFTitleCandidates({
      metadata: { Title: "Expected title" },
      get pages() {
        throw new Error("broken pages");
      },
    }),
    ["Expected title"],
  );
  assert.deepEqual(
    getPDFTitleCandidates({
      metadata: {
        get title() {
          throw new Error("broken title");
        },
        Title: "Expected title",
      },
    }),
    ["Expected title"],
  );
});

test("generic producer metadata is ignored while usable prefixed metadata is cleaned", () => {
  assert.deepEqual(
    getPDFTitleCandidates({ metadata: { title: "Microsoft Word" } }),
    [],
  );
  assert.deepEqual(
    getPDFTitleCandidates({ metadata: { title: "Untitled Document" } }),
    [],
  );
  assert.deepEqual(
    getPDFTitleCandidates({ metadata: { title: "draft.docx" } }),
    [],
  );
  assert.deepEqual(
    getPDFTitleCandidates({
      metadata: {
        title: "Microsoft Word - Protein folding in aqueous solution",
      },
    }),
    ["Protein folding in aqueous solution"],
  );
});

test("continuous title lines remain one candidate rather than joining all equal-size text", () => {
  const candidates = getPDFTitleCandidates({
    pages: [
      page([
        ["Journal of Electrochemistry", 30],
        ["High Performance Capacitive Deionization Cathode", 24],
        ["of Nickel Hexacyanoferrate Doped with Copper", 24],
        ["Wei Wang and Jane Smith", 12],
        ["Abstract", 24],
        ["Unrelated body paragraph", 12],
        ["An unrelated section heading", 24],
      ]),
    ],
  });
  assert.ok(candidates.includes(electrochemistryTitle));
  assert.ok(
    !candidates.some((candidate) => candidate.includes("unrelated section")),
  );
  accepts(electrochemistryTitle, "download.pdf", candidates);
});

test("later appendix typography never displaces the opening-page title", () => {
  const candidates = getPDFTitleCandidates({
    pages: [
      page([[electrochemistryTitle, 20]]),
      page([["Normal second-page text", 12]]),
      page([["APPENDIX: MUCH LARGER HEADING", 60]]),
    ],
  });
  assert.ok(candidates.includes(electrochemistryTitle));
  assert.ok(!candidates.some((candidate) => candidate.includes("APPENDIX")));
});

test("a second-page heading cannot masquerade as a different article title", () => {
  const title = "Deep learning for accurate prediction of protein structures";
  const candidates = getPDFTitleCandidates({
    pages: [
      page([[title.replace("structures", "functions"), 24]]),
      page([[title, 26]]),
    ],
  });
  assert.deepEqual(candidates, [title.replace("structures", "functions")]);
  rejects(title, "download.pdf", candidates);
});

test("malformed pages do not hide a later valid opening page", () => {
  const candidates = getPDFTitleCandidates({
    pages: [null, {}, [], [null], page([["Expected title"]])],
  });
  assert.deepEqual(candidates, ["Expected title"]);
});

test("exact title evidence is stronger than formatting-only equivalence", () => {
  assert.ok(
    scoreAttachmentMatch("Expected title", "random.pdf", ["Expected title"]) >
      scoreAttachmentMatch("Expected title", "random.pdf", ["Expected title!"]),
  );
  assert.ok(ATTACHMENT_MATCH_AMBIGUITY_MARGIN > 0);
  assert.ok(MIN_ATTACHMENT_MATCH_SCORE > 0.74);
});

test("native recognizer geometry joins different title sizes without joining authors", () => {
  const candidates = getPDFTitleCandidates({
    pages: [
      nativePage([
        nativeLine("High Performance Capacitive Deionization Cathode", {
          font: 24,
          y: 90,
        }),
        nativeLine("of Nickel Hexacyanoferrate Doped with Copper", {
          font: 20,
          y: 120,
        }),
        nativeLine("Alice Wang and Bob Smith", {
          font: 20,
          y: 174,
          bold: false,
        }),
        nativeLine("Abstract: We investigate electrode materials.", {
          font: 20,
          y: 220,
        }),
        ...nativeBody(),
      ]),
    ],
  });
  assert.ok(candidates.includes(electrochemistryTitle));
  assert.ok(
    !candidates.some(
      (title) =>
        title.includes("Copper Alice") || title.includes("investigate"),
    ),
  );
});

test("native mixed-size subscripts do not lower the title line font estimate", () => {
  const firstLine = [
    [
      nativeWord("High", { after: true }),
      nativeWord("Performance", { x: 130, after: true }),
      nativeWord("Fe", { x: 260 }),
      nativeWord("2", { x: 281, font: 12, y: 108, baseline: 120 }),
      nativeWord("O", { x: 286 }),
      nativeWord("3", { x: 297, font: 12, y: 108, baseline: 120, after: true }),
      nativeWord("Electrodes", { x: 308 }),
    ],
  ];
  const title = "High Performance Fe2O3 Electrodes for Capacitive Deionization";
  const candidates = getPDFTitleCandidates({
    pages: [
      nativePage([
        firstLine,
        nativeLine("for Capacitive Deionization", { y: 130 }),
        nativeLine("Abstract", { y: 220, font: 12 }),
        ...nativeBody(),
      ]),
    ],
  });
  assert.ok(candidates.includes(title));
  accepts(title, "download.pdf", candidates);
});

test("raised title footnotes can be omitted while chemical subscripts stay intact", () => {
  const first = nativeLine("High Performance Capacitive Deionization Cathode", {
    y: 90,
  });
  const second = nativeLine("of Nickel Hexacyanoferrate Doped with Copper", {
    y: 120,
  });
  second[0].push(nativeWord("1", { x: 590, y: 112, font: 12, baseline: 124 }));
  const candidates = getPDFTitleCandidates({
    pages: [
      nativePage([
        first,
        second,
        nativeLine("Abstract", { y: 220, font: 12 }),
        ...nativeBody(),
      ]),
    ],
  });
  assert.ok(candidates.includes(electrochemistryTitle));
});

test("same-sized nearby authors and publishers' issue notes are separate blocks", () => {
  const title = "Electrochemical Mineral Recovery from Seawater and Brines";
  const candidates = getPDFTitleCandidates({
    pages: [
      nativePage([
        nativeLine(title, { font: 17, y: 112 }),
        nativeLine("Published as part of a special issue", {
          font: 13,
          y: 136,
          bold: false,
        }),
        nativeLine("Alice Wang and Bob Smith", {
          font: 13,
          y: 170,
          bold: false,
        }),
        nativeLine("ABSTRACT: Mineral recovery is important.", {
          font: 10,
          y: 220,
          bold: false,
        }),
        ...nativeBody(),
      ]),
    ],
  });
  assert.ok(candidates.includes(title));
});

test("bold near-body-sized titles survive a much larger journal banner", () => {
  const candidates = getPDFTitleCandidates({
    pages: [
      nativePage([
        nativeLine("EXAMPLE JOURNAL", { font: 40, y: 30 }),
        nativeLine("High Performance Capacitive Deionization Cathode", {
          font: 13,
          y: 90,
        }),
        nativeLine("of Nickel Hexacyanoferrate Doped with Copper", {
          font: 13,
          y: 107,
        }),
        nativeLine("Abstract: The electrode is useful.", {
          font: 12,
          y: 180,
          bold: false,
        }),
        ...nativeBody().map(([words]) => [
          words.map((word) => {
            const next = [...word];
            next[4] = 12;
            return next;
          }),
        ]),
      ]),
    ],
  });
  assert.ok(candidates.includes(electrochemistryTitle));
});

test("only an explicit manuscript cover permits a second-page title", () => {
  const candidates = getPDFTitleCandidates({
    pages: [
      nativePage([nativeLine("Accepted Manuscript", { font: 36, y: 200 })]),
      nativePage([
        nativeLine(electrochemistryTitle, { y: 100 }),
        nativeLine("Abstract", { font: 12, y: 200 }),
        ...nativeBody(),
      ]),
    ],
  });
  assert.ok(candidates.includes(electrochemistryTitle));
  const ordinary = getPDFTitleCandidates({
    pages: [
      nativePage([
        nativeLine("Different article title", { y: 100 }),
        nativeLine("Abstract", { y: 200, font: 12 }),
      ]),
      nativePage([nativeLine(electrochemistryTitle, { y: 100 })]),
    ],
  });
  assert.ok(!ordinary.includes(electrochemistryTitle));
});

test("scientific conflicts veto exact filenames or stale metadata in either direction", () => {
  for (const [title, conflict] of [
    [
      "A controlled study of CO2 reduction on Fe2O3 electrodes",
      "A controlled study of CO2 reduction on Fe2O4 electrodes",
    ],
    [
      "Deep learning does improve clinical outcome prediction",
      "Deep learning does not improve clinical outcome prediction",
    ],
    [
      "A positive association between inflammation and cancer risk",
      "A negative association between inflammation and cancer risk",
    ],
  ]) {
    rejects(title, `${title}.pdf`, [conflict]);
    rejects(title, `${conflict}.pdf`, [title]);
    rejects(title, "download.pdf", [title, conflict]);
    accepts(title, `${title}.pdf`, [
      "An unrelated article about ecological succession",
    ]);
  }
});

test("DOI normalization keeps edition suffixes and balanced parentheses", () => {
  assert.equal(
    normalizeDOI(" https://doi.org/10.4321/EXAMPLE.2026.8. "),
    "10.4321/example.2026.8",
  );
  assert.equal(normalizeDOI("doi:10.4321/example.8)"), "10.4321/example.8");
  assert.equal(
    normalizeDOI("10.4321/(SICI)1234(2026)8"),
    "10.4321/(sici)1234(2026)8",
  );
  assert.equal(
    normalizeDOI("https://doi.org/10.4321%2Fexample.8"),
    "10.4321/example.8",
  );
  assert.equal(normalizeDOI("not a DOI"), "");
});

test("explicit article DOI outranks journal DOI and the recommended edition citation", () => {
  assert.deepEqual(
    getPDFPrimaryDOIs({
      metadata: {
        "WPS-JOURNALDOI": "10.4321/(ISSN)1234-5678",
        "WPS-ARTICLEDOI": "10.4321/example-local.2026.8",
        DOI: "10.4321/example-international.2026.8",
      },
      pages: [
        nativePage([
          nativeLine(
            "Recommended citation doi.org/10.4321/example-international.2026.8",
          ),
        ]),
      ],
    }),
    ["10.4321/example-local.2026.8"],
  );
  assert.deepEqual(
    getPDFPrimaryDOIs({ metadata: { "prism:doi": "10.4321/example.9" } }),
    ["10.4321/example.9"],
  );
  assert.deepEqual(
    getPDFPrimaryDOIs({
      metadata: { Subject: "Example Journal, doi:10.4321/example.10" },
    }),
    ["10.4321/example.10"],
  );
});

test("page DOI fallback refuses multiple identities and references-only matches", () => {
  assert.deepEqual(
    getPDFPrimaryDOIs({
      pages: [nativePage([nativeLine("https://doi.org/10.4321/example.11")])],
    }),
    ["10.4321/example.11"],
  );
  assert.deepEqual(
    getPDFPrimaryDOIs({
      pages: [
        nativePage([
          nativeLine("https://doi.org/10.4321/example.11", { y: 80 }),
          nativeLine("https://doi.org/10.4321/example.12", { y: 100 }),
        ]),
      ],
    }),
    [],
  );
  assert.deepEqual(
    getPDFPrimaryDOIs({
      pages: [
        nativePage([
          nativeLine("References", { y: 80 }),
          nativeLine("https://doi.org/10.4321/example.11", { y: 100 }),
        ]),
      ],
    }),
    [],
  );
});

test("document role detects explicit supplement metadata and download filenames", () => {
  for (const title of [
    "Supporting Information",
    "Supporting Information for Molecular Electrode Design",
    "Supplementary Materials: Molecular Electrode Design",
    "Electronic Supplementary Material",
    "Supplemental Data for Molecular Electrode Design",
  ]) {
    assert.equal(
      getPDFDocumentRole({ metadata: { Title: title } }),
      "supplement",
    );
  }
  assert.equal(getPDFDocumentRole({}, "supporting-info.pdf"), "supplement");
  assert.equal(
    getPDFDocumentRole({}, "/download/supplementary_material.pdf"),
    "supplement",
  );
  assert.equal(
    getPDFDocumentRole({}, "Supporting Information (1).pdf"),
    "supplement",
  );
  assert.equal(getPDFDocumentRole({}, "si.pdf"), "unknown");
  assert.equal(getPDFDocumentRole({}, "article-s1.pdf"), "unknown");
});

test("document role distinguishes correction notices from scientific correction topics", () => {
  for (const title of [
    "Correction to: Molecular Electrode Design",
    "Author Correction: Molecular Electrode Design",
    "Publisher Correction: Molecular Electrode Design",
    "Erratum",
    "Corrigendum to Molecular Electrode Design",
    "Retraction notice for Molecular Electrode Design",
  ]) {
    assert.equal(getPDFDocumentRole({ metadata: { title } }), "correction");
  }
  assert.equal(
    getPDFDocumentRole({
      metadata: {
        Title: "Correction of systematic errors in electrode measurements",
      },
    }),
    "unknown",
  );
  assert.equal(
    getPDFDocumentRole({
      metadata: {
        Title: "Supporting information processing in scientific workflows",
      },
    }),
    "unknown",
  );
});

test("document role uses prominent page-top labels but ignores supplement availability footers", () => {
  assert.equal(
    getPDFDocumentRole({
      pages: [
        nativePage([
          nativeLine("Supporting Information", { font: 24, y: 72 }),
          nativeLine("Molecular Electrode Design", { font: 20, y: 110 }),
        ]),
      ],
    }),
    "supplement",
  );
  assert.equal(
    getPDFDocumentRole({
      metadata: { Title: "Molecular Electrode Design" },
      pages: [
        nativePage([
          nativeLine("Molecular Electrode Design", { font: 24, y: 72 }),
          nativeLine("Abstract: Electrodes are useful.", { font: 10, y: 180 }),
          nativeLine("Supporting Information", { font: 24, y: 710 }),
          nativeLine("Supporting Information is available online.", {
            font: 10,
            y: 740,
          }),
        ]),
      ],
    }),
    "unknown",
  );
  assert.equal(
    getPDFDocumentRole({
      metadata: { Title: "Supporting Information is available online" },
    }),
    "unknown",
  );
  assert.equal(
    getPDFDocumentRole({
      pages: [
        nativePage([
          nativeLine("Supporting Information available online", {
            font: 24,
            y: 72,
          }),
        ]),
      ],
    }),
    "unknown",
  );
});
