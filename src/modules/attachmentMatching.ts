export const MIN_ATTACHMENT_MATCH_SCORE = 0.8;
export const ATTACHMENT_MATCH_AMBIGUITY_MARGIN = 0.05;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  ndash: "-",
  mdash: "-",
  minus: "-",
  shy: "",
  alpha: "\u03b1",
  beta: "\u03b2",
  gamma: "\u03b3",
  delta: "\u03b4",
  epsilon: "\u03b5",
  theta: "\u03b8",
  lambda: "\u03bb",
  mu: "\u03bc",
  pi: "\u03c0",
  sigma: "\u03c3",
  phi: "\u03c6",
  omega: "\u03c9",
  aacute: "a",
  agrave: "a",
  acirc: "a",
  atilde: "a",
  auml: "a",
  aring: "a",
  aelig: "ae",
  ccedil: "c",
  eacute: "e",
  egrave: "e",
  ecirc: "e",
  euml: "e",
  iacute: "i",
  igrave: "i",
  icirc: "i",
  iuml: "i",
  ntilde: "n",
  oacute: "o",
  ograve: "o",
  ocirc: "o",
  otilde: "o",
  ouml: "o",
  oslash: "o",
  oelig: "oe",
  uacute: "u",
  ugrave: "u",
  ucirc: "u",
  uuml: "u",
  yacute: "y",
  yuml: "y",
  szlig: "ss",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "using",
  "via",
  "with",
]);

const NEGATIONS = new Set(["no", "not", "without", "neither", "nor", "non"]);
const QUALIFIERS = new Set([
  "positive",
  "negative",
  "increase",
  "increases",
  "increased",
  "increasing",
  "decrease",
  "decreases",
  "decreased",
  "decreasing",
]);

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, value) => {
    if (value[0] !== "#") {
      return HTML_ENTITIES[value.toLowerCase()] ?? entity;
    }
    const code = /^#x/i.test(value)
      ? parseInt(value.slice(2), 16)
      : parseInt(value.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : " ";
  });
}

function plainText(text: string): string {
  return decodeEntities(text)
    .replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/([\p{L}])[-\u2010\u2011]\s*\r?\n\s*(?=\p{L})/gu, "$1")
    .replace(/\u00ad/g, "")
    .replace(/[\u00e6\u00c6]/g, "ae")
    .replace(/[\u0153\u0152]/g, "oe")
    .replace(/\u00df/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

/** Keep digits and chemical formulae; punctuation is a word boundary, not noise. */
export function normalizeMatchTitle(text: string): string {
  if (typeof text !== "string") return "";
  return plainText(text)
    .toLowerCase()
    .replace(/\bnon[-\u2010-\u2015](?=[a-z])/g, "non")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(
      /([\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af])\s+(?=[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af])/g,
      "$1",
    )
    .trim()
    .replace(/\s+/g, " ");
}

function safeGet(object: any, key: string): any {
  try {
    return object?.[key];
  } catch {
    return undefined;
  }
}

/** Accept DOI strings and resolver URLs, without changing edition-specific suffixes. */
export function normalizeDOI(value: unknown): string {
  if (typeof value !== "string") return "";
  let text = decodeEntities(value).trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // A literal percent in a DOI is not necessarily URI escaping.
  }
  text = text
    .replace(/^\s*(?:doi\s*:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/i, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
  const match = /^10\.\d{4,9}\/[^\s<>"'?#]+/i.exec(text);
  if (!match) return "";
  let doi = match[0].replace(/[.,;:]+$/, "");
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]) {
    while (
      doi.endsWith(close) &&
      doi.split(close).length > doi.split(open).length
    ) {
      doi = doi.slice(0, -1);
    }
  }
  return doi.length > doi.indexOf("/") + 1 ? doi.toLowerCase() : "";
}

function extractDOIs(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const found = decodeEntities(value).match(/10\.\d{4,9}\/[^\s<>"']+/gi) || [];
  return [...new Set(found.map(normalizeDOI).filter(Boolean))];
}

/** Explicit article metadata takes precedence over recommended citations on the page. */
export function getPDFPrimaryDOIs(data: any): string[] {
  const metadata = safeGet(data, "metadata");
  const ranked: { rank: number; values: string[] }[] = [];
  let keys: string[] = [];
  try {
    keys =
      metadata && typeof metadata === "object" ? Object.keys(metadata) : [];
  } catch {
    // Continue with page text if metadata is malformed.
  }
  for (const key of keys) {
    const name = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/journal|issn|reference|citation|related/.test(name)) continue;
    const rank = name.endsWith("articledoi")
      ? 0
      : name === "doi" || name.endsWith("prismdoi") || name === "dcidentifier"
        ? 1
        : name === "subject" || name === "description"
          ? 2
          : -1;
    if (rank < 0) continue;
    const values = extractDOIs(safeGet(metadata, key));
    if (values.length) ranked.push({ rank, values });
  }
  if (ranked.length) {
    const rank = Math.min(...ranked.map((entry) => entry.rank));
    return [
      ...new Set(
        ranked
          .filter((entry) => entry.rank === rank)
          .flatMap((entry) => entry.values),
      ),
    ];
  }

  const pages = safeGet(data, "pages");
  if (!Array.isArray(pages)) return [];
  for (const page of pages.slice(0, 5)) {
    const lines = pageLines(page);
    if (!lines.length) continue;
    const values = new Set<string>();
    for (const line of lines) {
      if (/^(?:references|bibliography)\s*[:.]?\s*$/i.test(line.text.trim()))
        break;
      // A citation panel is not reliable evidence for the edition of this PDF.
      if (
        /cite\s+(?:this|as)|how\s+to\s+cite|related\s+(?:article|version)|recommended\s+citation/i.test(
          line.text,
        )
      )
        continue;
      for (const doi of extractDOIs(line.text.replace(/\s*([/.])\s*/g, "$1"))) {
        if (!/\(issn\)/i.test(doi)) values.add(doi);
      }
    }
    // Multiple page DOIs can be related editions or references; preserve uncertainty.
    return values.size === 1 ? [...values] : [];
  }
  return [];
}

export type PDFDocumentRole = "supplement" | "correction" | "unknown";

function documentRoleLabel(value: unknown): PDFDocumentRole {
  if (typeof value !== "string") return "unknown";
  const text = plainText(value).replace(/\s+/g, " ").trim();
  if (
    /^(?:(?:electronic\s+)?supplementary\s+(?:information|materials?|data)|supplemental\s+(?:information|materials?|data)|supporting\s+(?:information|materials?|data))\s*(?:$|[:\u2013\u2014-]|(?:for|to)\b)/i.test(
      text,
    )
  )
    return "supplement";
  if (
    /^(?:(?:(?:author|publisher)\s+)?correction\s*(?:$|:|to\b)|(?:erratum|corrigendum|retraction(?:\s+notice)?)\s*(?:$|:|(?:to|for|of)\b))/i.test(
      text,
    )
  )
    return "correction";
  return "unknown";
}

/** A shared article DOI does not make supplementary files or notices the main paper. */
export function getPDFDocumentRole(data: any, filename = ""): PDFDocumentRole {
  const metadata = safeGet(data, "metadata");
  for (const key of ["title", "Title"]) {
    const role = documentRoleLabel(safeGet(metadata, key));
    if (role !== "unknown") return role;
  }
  const stem = filename
    .replace(/^.*[/\\]/, "")
    .replace(/\.pdf$/i, "")
    .replace(/(?:\s+\(\d+\))+$/, "");
  const filenameRole = documentRoleLabel(
    stem.replace(/[_-]+/g, " ").replace(/\binfo\b/gi, "information"),
  );
  if (filenameRole !== "unknown") return filenameRole;

  const pages = safeGet(data, "pages");
  if (!Array.isArray(pages)) return "unknown";
  for (const page of pages.slice(0, 5)) {
    const lines = pageLines(page);
    if (!lines.length) continue;
    const height =
      Array.isArray(page) && Number.isFinite(page[1]) ? page[1] : 0;
    const maximum = Math.max(
      ...lines.slice(0, 40).map((line) => line.fontSize),
    );
    for (const line of lines.slice(0, 16)) {
      if (isBodyHeading(line.text)) break;
      // Require actual top-of-page geometry, not a body/footer availability note.
      if (
        !height ||
        !line.geometry ||
        line.yMin > height * 0.35 ||
        line.fontSize < maximum * 0.8
      )
        continue;
      const role = documentRoleLabel(line.text);
      if (role !== "unknown") return role;
    }
    break;
  }
  return "unknown";
}

function cleanCandidate(value: unknown): string {
  if (typeof value !== "string" || value.length > 1500) return "";
  const title = plainText(value)
    .replace(/^\s*(?:microsoft\s+(?:word|powerpoint)|latex)\s*[-:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeMatchTitle(title);
  if (
    !/\p{L}/u.test(normalized) ||
    /^(?:untitled(?: document)?|microsoft(?: word| powerpoint| excel)?|adobe acrobat|acrobat distiller|document\s*\d*|full text|pdf|title|unknown|default)$/i.test(
      normalized,
    ) ||
    /^\S+\.(?:pdf|docx?|pptx?|tex)$/i.test(title) ||
    /^[a-z]{1,8}\d[a-z0-9]*\s+\d+\s*\.\.\s*\d+$/i.test(title) ||
    /^(?:doi\s*:|https?:\/\/|www\.)/i.test(title)
  ) {
    return "";
  }
  return title;
}

type RecognizerWord = {
  text: string;
  fontSize: number;
  spaceAfter: boolean;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  baseline: number;
  bold: number;
};

type RecognizerLine = {
  text: string;
  fontSize: number;
  bold: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  geometry: boolean;
  words: RecognizerWord[];
};

function weightedMedian(values: { value: number; weight: number }[]): number {
  const sorted = values
    .filter(({ value }) => Number.isFinite(value))
    .sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, entry) => sum + entry.weight, 0) / 2;
  let weight = 0;
  for (const entry of sorted) {
    weight += entry.weight;
    if (weight >= half) return entry.value;
  }
  return 0;
}

function makeLine(words: RecognizerWord[]): RecognizerLine {
  const weight = (word: RecognizerWord) => Math.max(1, word.text.length);
  const fontSize = weightedMedian(
    words.map((word) => ({ value: word.fontSize, weight: weight(word) })),
  );
  return {
    text: words
      .map((word) => word.text + (word.spaceAfter ? " " : ""))
      .join("")
      .trim(),
    fontSize,
    bold:
      words.reduce((sum, word) => sum + word.bold * weight(word), 0) /
      words.reduce((sum, word) => sum + weight(word), 0),
    xMin: Math.min(...words.map((word) => word.xMin)),
    yMin: Math.min(...words.map((word) => word.yMin)),
    xMax: Math.max(...words.map((word) => word.xMax)),
    yMax: Math.max(...words.map((word) => word.yMax)),
    geometry:
      words.every((word) =>
        Number.isFinite(word.xMin + word.yMin + word.xMax + word.yMax),
      ) && words.some((word) => word.xMax > word.xMin && word.yMax > word.yMin),
    words,
  };
}

function pageLines(page: unknown): RecognizerLine[] {
  const lines: RecognizerLine[] = [];
  let visited = 0;
  const isWord = (word: any): word is any[] =>
    Array.isArray(word) &&
    word.length >= 7 &&
    Number.isFinite(word[4]) &&
    word[4] > 0 &&
    typeof word[word.length - 1] === "string";
  const visit = (node: unknown, depth: number) => {
    if (!Array.isArray(node) || depth > 12 || visited++ > 4000) return;
    const words = node.filter(isWord);
    if (words.length) {
      const line = makeLine(
        words.map((word) => ({
          text: word[word.length - 1],
          fontSize: word[4],
          spaceAfter: word[5] > 0,
          xMin: word[0],
          yMin: word[1],
          xMax: word[2],
          yMax: word[3],
          baseline:
            word.length >= 14 && Number.isFinite(word[6]) ? word[6] : NaN,
          bold: word.length >= 14 && word[9] ? 1 : 0,
        })),
      );
      if (line.text) lines.push(line);
      return;
    }
    for (const child of node) visit(child, depth + 1);
  };
  visit(page, 0);
  // PDF text streams are not guaranteed to follow visual order.
  if (lines.every((line) => line.geometry))
    lines.sort((a, b) => a.yMin - b.yMin || a.xMin - b.xMin);
  return lines;
}

function isBodyHeading(text: string): boolean {
  return /^(?:(?:\d+\.?\s+)?(?:abstract|keywords?|introduction|references|contents)\s*[:.]?\s*|(?:abstract|keywords?)\s*[:.\u2013\u2014-]\s*.+)$/i.test(
    text.trim(),
  );
}

function isRepositoryCover(lines: RecognizerLine[]): boolean {
  const text = lines
    .slice(0, 30)
    .map((line) => line.text)
    .join(" ");
  return (
    /\b(?:accepted manuscript|author manuscript|institutional repository|repository copy|accepted version)\b/i.test(
      text,
    ) &&
    !lines.some((line) => isBodyHeading(line.text)) &&
    text.length < 2500
  );
}

function titleLineText(line: RecognizerLine): string {
  if (!line.geometry || line.words.length < 2) return line.text;
  const baseline = weightedMedian(
    line.words
      .filter((word) => word.fontSize >= line.fontSize * 0.85)
      .map((word) => ({
        value: word.baseline,
        weight: Math.max(1, word.text.length),
      })),
  );
  const words = [...line.words];
  while (words.length > 1) {
    const tail = words[words.length - 1];
    const previous = words[words.length - 2];
    if (
      tail.fontSize > line.fontSize * 0.75 ||
      !Number.isFinite(tail.baseline) ||
      tail.baseline >= baseline - line.fontSize * 0.15 ||
      !/^(?:\d{1,2}|[*\u2020\u2021\u00a7\u00b6\u2225]+)$/.test(tail.text) ||
      !/[a-z]{4,}$/i.test(previous.text)
    )
      break;
    words.pop();
  }
  return words
    .map((word) => word.text + (word.spaceAfter ? " " : ""))
    .join("")
    .trim();
}

function sameTitleBlock(
  previous: RecognizerLine,
  line: RecognizerLine,
): boolean {
  const ratio = line.fontSize / previous.fontSize;
  if (!previous.geometry || !line.geometry) return Math.abs(1 - ratio) <= 0.08;
  const size = Math.max(previous.fontSize, line.fontSize);
  return (
    ratio >= 0.72 &&
    ratio <= 1.08 &&
    line.yMin - previous.yMin <= size * 1.8 &&
    line.yMin >= previous.yMin &&
    line.xMin <= previous.xMax &&
    line.xMax >= previous.xMin &&
    Math.abs(line.bold - previous.bold) <= 0.55 &&
    (ratio >= 0.88 || (previous.bold >= 0.6 && line.bold >= 0.6))
  );
}

/** Metadata and front-page text are independent evidence; neither replaces the other. */
export function getPDFTitleCandidates(data: any): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    const title = cleanCandidate(value);
    const key = normalizeMatchTitle(title);
    if (title && !seen.has(key)) {
      candidates.push(title);
      seen.add(key);
    }
  };
  const metadata = safeGet(data, "metadata");
  add(safeGet(metadata, "title"));
  add(safeGet(metadata, "Title"));

  // A malformed pages getter must not discard usable metadata.
  const pages = safeGet(data, "pages");
  if (!Array.isArray(pages)) return candidates;
  let coverRead = false;
  for (const page of pages.slice(0, 8)) {
    const lines = pageLines(page);
    if (!lines.length) continue;
    const opening = lines.slice(0, 60);
    const fonts = lines
      .slice(0, 100)
      .map((line) => line.fontSize)
      .sort((a, b) => a - b);
    const bodyFont = fonts[Math.floor(fonts.length / 2)];
    const maximumFont = Math.max(...opening.map((line) => line.fontSize));
    let group: RecognizerLine[] = [];
    const flush = () => {
      if (group.length) add(group.map(titleLineText).join("\n"));
      group = [];
    };
    for (const line of opening) {
      if (isBodyHeading(line.text)) {
        flush();
        break;
      }
      const prominent =
        line.fontSize >= bodyFont * 1.08 ||
        line.fontSize >= maximumFont * 0.72 ||
        (line.bold >= 0.6 && line.fontSize >= bodyFont * 0.98);
      if (!prominent) {
        flush();
        continue;
      }
      const previous = group[group.length - 1];
      if (previous && (!sameTitleBlock(previous, line) || group.length >= 8)) {
        flush();
      }
      group.push(line);
    }
    flush();
    // Only an explicit repository/accepted-manuscript cover permits page two.
    if (!coverRead && isRepositoryCover(lines)) coverRead = true;
    else break;
  }
  return candidates;
}

function sameTokens(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((token, i) => token === right[i])
  );
}

function criticalTokens(tokens: string[]): string[] {
  return tokens.filter(
    (token) =>
      NEGATIONS.has(token) ||
      QUALIFIERS.has(token) ||
      (/^non[a-z]{3,}$/.test(token) &&
        !/^(?:nonetheless|nonsense|nonsensical)$/.test(token)),
  );
}

function tokenAffinity(left: string, right: string): number {
  if (left === right) return 1;
  const shortest = Math.min(left.length, right.length);
  if (
    shortest < 7 ||
    /\d/.test(left + right) ||
    NEGATIONS.has(left) ||
    NEGATIONS.has(right) ||
    QUALIFIERS.has(left) ||
    QUALIFIERS.has(right)
  ) {
    return 0;
  }
  const spelling = (word: string) =>
    word
      .replace(/isation(s)?$/, "ization$1")
      .replace(/is(ed|ing)$/, "iz$1")
      .replace(/^colour/, "color")
      .replace(/^behaviour/, "behavior")
      .replace(/^tumour/, "tumor")
      .replace(/^favour/, "favor")
      .replace(/^centre/, "center")
      .replace(/^fibre/, "fiber");
  if (spelling(left) === spelling(right)) return 0.96;
  if (shortest < 9 || Math.abs(left.length - right.length) > 1) return 0;
  // Restrict fuzzy tokens to known OCR glyph confusions, not arbitrary edits.
  const ocr = (word: string) =>
    word
      .replace(/rn/g, "m")
      .replace(/cl/g, "d")
      .replace(/vv/g, "w")
      .replace(/i/g, "l");
  if (ocr(left) === ocr(right)) {
    return 0.9;
  }
  return 0;
}

function titleScore(itemTitle: string, candidate: string): number {
  const left = normalizeMatchTitle(itemTitle);
  const right = normalizeMatchTitle(candidate);
  if (!left || !right || !/\p{L}/u.test(left)) return 0;
  if (left === right) {
    return itemTitle.trim().toLowerCase() === candidate.trim().toLowerCase()
      ? 1
      : 0.99;
  }
  const leftTokens = left.split(" ").slice(0, 100);
  const rightTokens = right.split(" ").slice(0, 140);
  const leftNumbers = left.match(/\d+/g) || [];
  const rightNumbers = right.match(/\d+/g) || [];
  if (
    !sameTokens(leftNumbers, rightNumbers) ||
    !sameTokens(criticalTokens(leftTokens), criticalTokens(rightTokens))
  ) {
    return 0.15;
  }
  if (left.length >= 18 && left.replace(/ /g, "") === right.replace(/ /g, "")) {
    return 0.985;
  }
  const leftContent = leftTokens.filter((token) => !STOP_WORDS.has(token));
  const rightContent = rightTokens.filter((token) => !STOP_WORDS.has(token));
  // Short/generic titles are useful only as whole-title exact matches.
  if (left.length < 18 || leftContent.length < 3 || rightContent.length < 3) {
    return 0;
  }

  const rows = Array.from(
    { length: leftContent.length + 1 },
    () => Array(rightContent.length + 1).fill(0) as number[],
  );
  for (let i = 1; i <= leftContent.length; i++) {
    for (let j = 1; j <= rightContent.length; j++) {
      rows[i][j] = Math.max(
        rows[i - 1][j],
        rows[i][j - 1],
        rows[i - 1][j - 1] +
          tokenAffinity(leftContent[i - 1], rightContent[j - 1]),
      );
    }
  }
  const matched = rows[leftContent.length][rightContent.length];
  const coverage = (2 * matched) / (leftContent.length + rightContent.length);
  if (
    leftContent.length !== rightContent.length ||
    leftContent.some((token, i) => !tokenAffinity(token, rightContent[i])) ||
    matched < leftContent.length * 0.96
  ) {
    // Sharing a field or most of a title is not evidence of the same article.
    return Math.min(0.74, coverage * 0.74);
  }
  return 0.9 + coverage * 0.08;
}

function hardTitleConflict(itemTitle: string, candidate: string): boolean {
  const left = normalizeMatchTitle(itemTitle);
  const right = normalizeMatchTitle(candidate);
  if (Math.min(left.length, right.length) < 32) return false;
  const leftTokens = left.split(" ");
  const rightTokens = right.split(" ");
  if (
    sameTokens(left.match(/\d+/g) || [], right.match(/\d+/g) || []) &&
    sameTokens(criticalTokens(leftTokens), criticalTokens(rightTokens))
  )
    return false;
  const skeleton = (tokens: string[]) =>
    tokens
      .filter(
        (token) =>
          !STOP_WORDS.has(token) &&
          !NEGATIONS.has(token) &&
          !QUALIFIERS.has(token),
      )
      .map((token) =>
        token.replace(/^non(?=[a-z]{3,}$)/, "").replace(/\d+/g, ""),
      )
      .filter(Boolean);
  const a = skeleton(leftTokens);
  const b = skeleton(rightTokens);
  if (Math.min(a.length, b.length) < 4) return false;
  let previous = Array(b.length + 1).fill(0) as number[];
  for (const token of a) {
    const next = [0];
    for (let j = 1; j <= b.length; j++) {
      next.push(
        Math.max(
          previous[j],
          next[j - 1],
          previous[j - 1] + (token === b[j - 1] ? 1 : 0),
        ),
      );
    }
    previous = next;
  }
  const common = previous[b.length];
  // Only a near-identical article title can contradict otherwise good evidence.
  // Unrelated or generic PDF producer metadata is never a veto.
  return (
    common / Math.max(a.length, b.length) >= 0.9 &&
    common / Math.min(a.length, b.length) >= 0.95
  );
}

function filenameVariants(filename: string, itemTitle: string): string[] {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.(?:pdf|caj)$/i, "");
  const variants = [base];
  let withoutCopyNumber = base;
  while (/\s+\(\d+\)\s*$/.test(withoutCopyNumber) && variants.length < 5) {
    withoutCopyNumber = withoutCopyNumber.replace(/\s+\(\d+\)\s*$/, "");
    variants.push(withoutCopyNumber);
  }
  const title = normalizeMatchTitle(itemTitle);
  if (
    title.length < 24 ||
    title.split(" ").filter((word) => !STOP_WORDS.has(word)).length < 3
  ) {
    return variants;
  }
  for (const value of [...variants]) {
    const separators = /\s+[-\u2010-\u2015]\s+|_+/g;
    let match: RegExpExecArray | null;
    while ((match = separators.exec(value))) {
      const prefix = value.slice(0, match.index);
      if (prefix.length > 180) continue;
      if (
        (prefix.match(/\d+/g) || []).some(
          (number) => !/^(?:18|19|20)\d{2}$/.test(number),
        )
      ) {
        continue;
      }
      if (
        /\b(?:comment|reply|correction|erratum|retraction|retracted|supplement(?:ary)?|part|chapter|section|phase|volume|version|figure|table)\b/i.test(
          prefix,
        ) ||
        /\b(?:review|analysis|discussion|evaluation|study|effect|effects)\s+of\b/i.test(
          prefix,
        ) ||
        criticalTokens(normalizeMatchTitle(prefix).split(" ")).length
      ) {
        continue;
      }
      if (
        match[0].includes("_") &&
        !/\b(?:19|20)\d{2}\b/.test(prefix.replace(/_/g, " "))
      ) {
        continue;
      }
      variants.push(value.slice(match.index + match[0].length));
    }
  }
  return variants;
}

/** Return confidence, not a nearest-neighbour distance: unrelated files stay unmatched. */
export function scoreAttachmentMatch(
  itemTitle: string,
  filename: string,
  pdfTitles: readonly string[],
): number {
  const variants = filenameVariants(filename, itemTitle);
  let best = 0;
  let filenameEvidence = variants[0];
  let filenameScore = -1;
  for (let i = 0; i < variants.length; i++) {
    const score = titleScore(itemTitle, variants[i]);
    if (score > filenameScore) {
      filenameScore = score;
      filenameEvidence = variants[i];
    }
    best = Math.max(best, i > 1 ? score * 0.97 : score);
  }
  if (hardTitleConflict(itemTitle, filenameEvidence)) return 0;
  for (const title of pdfTitles) {
    if (typeof title === "string" && cleanCandidate(title)) {
      if (hardTitleConflict(itemTitle, title)) return 0;
      best = Math.max(best, titleScore(itemTitle, title));
    }
  }
  return Math.min(1, best);
}
