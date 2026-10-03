import { createServer, type Server } from "node:http";

// A stand-in for the Anthropic Messages API, for tests only. The app talks to it through the
// SDK's standard ANTHROPIC_BASE_URL setting; nothing in the app knows it is a mock. The answer
// depends on a marker in the farmer's note, so a test can choose what "the AI" says:
//   [blurry]  → the photo is not usable          [refuse] → the model declines
//   [fail]    → the API is down (HTTP 500)        [garbled] → an answer that is not valid JSON
//   [serious-ai] → a confident answer that sends the farmer to an expert
//   otherwise → a medium-confidence answer with two possible causes
// Farm assistant questions (recognised by its instructions) use the same [fail]/[refuse]/[garbled]
// markers, plus [unsure] (low confidence, nothing to ask) and [missing] (asks the farmer back).

export const MOCK_ANSWER = {
  image_usable: true,
  summary: "Some lower leaves are yellow. This often comes from too little nitrogen or too much water.",
  possible_causes: [
    { name: "Nitrogen shortage", why: "The yellowing starts at the older, lower leaves.", likelihood: "MEDIUM" },
    { name: "Waterlogging", why: "Wet soil can also turn lower leaves yellow.", likelihood: "LOW" },
  ],
  confidence: "MEDIUM",
  next_steps: ["Check whether water stands in the field after rain.", "Compare with plants in a drier part of the field."],
  see_expert: false,
  expert_reason: null,
  more_information_needed: ["A close photo of one yellow leaf, both sides."],
};

const BLURRY = {
  ...MOCK_ANSWER,
  image_usable: false,
  summary: "The photo is too far away to see the leaves.",
  possible_causes: [{ name: "Unknown", why: "Leaves not visible", likelihood: "LOW" }],
  confidence: "HIGH",
  more_information_needed: [],
};

const SERIOUS = {
  ...MOCK_ANSWER,
  summary: "Many plants show spreading brown spots.",
  confidence: "HIGH",
  see_expert: true,
  expert_reason: "Spots that spread fast can damage the whole field.",
};

export const MOCK_ASSISTANT_ANSWER = {
  answer: "Your maize was sown 30 days ago. Check the field for weeds and whether the soil is dry.",
  based_on: ["Maize sown 30 days ago on Back plot", "Weeding recorded 10 days ago"],
  missing_information: [],
  confidence: "MEDIUM",
  see_expert: false,
  expert_reason: null,
};

const ASSISTANT_UNSURE = { ...MOCK_ASSISTANT_ANSWER, answer: "I cannot tell from your records.", based_on: [], confidence: "LOW" };
const ASSISTANT_MISSING = {
  ...MOCK_ASSISTANT_ANSWER,
  answer: "It depends on the variety you sowed.",
  missing_information: ["Which maize variety did you sow?"],
  confidence: "LOW",
};

function assistantAnswer(question: string) {
  if (question.includes("[unsure]")) return ASSISTANT_UNSURE;
  if (question.includes("[missing]")) return ASSISTANT_MISSING;
  return MOCK_ASSISTANT_ANSWER;
}

export type MockRequest = { path: string; body: Record<string, unknown> };

function noteOf(body: Record<string, unknown>): string {
  return JSON.stringify(body.messages ?? "");
}

function message(text: string, stopReason = "end_turn") {
  return {
    id: "msg_mock",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: text ? [{ type: "text", text }] : [],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: stopReason === "refusal" ? { type: "refusal", category: null, explanation: null } : null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

export async function startMockAnthropic(port = 0): Promise<{ server: Server; url: string; requests: MockRequest[] }> {
  const requests: MockRequest[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      requests.push({ path: req.url ?? "", body });
      const note = noteOf(body);
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (note.includes("[fail]")) return send(500, { type: "error", error: { type: "api_error", message: "mock failure" } });
      if (note.includes("[refuse]")) return send(200, message("", "refusal"));
      if (note.includes("[garbled]")) return send(200, message("this is not json"));
      if (String(body.system ?? "").includes("farm assistant")) return send(200, message(JSON.stringify(assistantAnswer(note))));
      if (note.includes("[blurry]")) return send(200, message(JSON.stringify(BLURRY)));
      if (note.includes("[serious-ai]")) return send(200, message(JSON.stringify(SERIOUS)));
      return send(200, message(JSON.stringify(MOCK_ANSWER)));
    });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return { server, url: `http://127.0.0.1:${actualPort}`, requests };
}
