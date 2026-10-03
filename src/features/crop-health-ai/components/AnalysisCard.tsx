import { todayInIndia, formatDate } from "@/features/crops/dates";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { analysisFeedbackAction } from "../actions";
import type { CropHealthAnalysis } from "../repository";
import type { Level } from "../schema";

import { FeedbackForm } from "./AskAiForm";

const confidenceStyle: Record<Level, string> = {
  HIGH: "bg-green-100 text-green-900",
  MEDIUM: "bg-amber-100 text-amber-900",
  LOW: "bg-red-100 text-red-900",
};

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-lg font-semibold text-stone-900">{title}</h4>
      <ul className="list-disc pl-6 text-lg text-stone-800">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One AI answer, shown with its uncertainty first (USER_WORKFLOWS.md section 18) and always
 * marked as an AI suggestion, separate from the farmer's own observation.
 */
export function AnalysisCard({ t, locale, analysis }: { t: Messages; locale: Locale; analysis: CropHealthAnalysis }) {
  const r = analysis.result;
  const confidence = (["LOW", "MEDIUM", "HIGH"] as const).includes(analysis.confidence as Level) ? (analysis.confidence as Level) : "LOW";
  const confidenceText = { HIGH: t.cropHealthAi.confidenceHigh, MEDIUM: t.cropHealthAi.confidenceMedium, LOW: t.cropHealthAi.confidenceLow }[confidence];
  const likelihood = { HIGH: t.cropHealthAi.likelihoodHigh, MEDIUM: t.cropHealthAi.likelihoodMedium, LOW: t.cropHealthAi.likelihoodLow };
  const feedbackLabel = {
    HELPFUL: t.cropHealthAi.feedbackHelpful,
    NOT_HELPFUL: t.cropHealthAi.feedbackNotHelpful,
    NOT_SURE: t.cropHealthAi.feedbackNotSure,
  }[analysis.farmer_feedback ?? ""] as string | undefined;

  return (
    <article data-testid="ai-analysis" className="flex flex-col gap-4 rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5">
      <header className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-stone-900">
          {format(t.cropHealthAi.heading, { date: formatDate(todayInIndia(new Date(analysis.created_at)), locale) })}
        </h3>
        <span data-testid="ai-confidence" className={`inline-flex min-h-8 w-fit items-center rounded-full px-3 text-base font-semibold ${confidenceStyle[confidence]}`}>
          {confidenceText}
        </span>
      </header>

      {analysis.image_usable ? null : <p className="text-lg font-medium text-stone-900">{t.cropHealthAi.imageNotUsable}</p>}
      <p className="text-lg text-stone-900">{r.summary}</p>

      {r.possible_causes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold text-stone-900">{t.cropHealthAi.causesTitle}</h4>
          <ul className="flex flex-col gap-2">
            {r.possible_causes.map((c) => (
              <li key={c.name} className="rounded-xl bg-white p-3" data-testid="ai-cause">
                <span className="text-lg font-semibold text-stone-900">{c.name}</span>{" "}
                <span className="text-base text-stone-600">({likelihood[c.likelihood] ?? c.likelihood})</span>
                <p className="text-base text-stone-800">{c.why}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <List title={t.cropHealthAi.stepsTitle} items={r.next_steps} />
      <List title={t.cropHealthAi.moreInfoTitle} items={r.more_information_needed} />

      {analysis.see_expert ? (
        <section className="flex flex-col gap-1 rounded-xl border-2 border-red-200 bg-red-50 p-4" data-testid="ai-expert">
          <h4 className="text-lg font-semibold text-red-900">{t.cropHealthAi.expertTitle}</h4>
          {r.expert_reason ? <p className="text-lg text-red-900">{r.expert_reason}</p> : null}
          <p className="text-base text-red-900">{t.cropHealthAi.expertWhere}</p>
        </section>
      ) : null}

      <p className="text-base text-stone-700" data-testid="ai-disclaimer">
        {t.cropHealthAi.disclaimer}
      </p>

      {feedbackLabel ? (
        <p className="text-lg text-stone-800" role="status">
          {format(t.cropHealthAi.feedbackThanks, { answer: feedbackLabel })}
        </p>
      ) : (
        <FeedbackForm t={t} action={analysisFeedbackAction.bind(null, analysis.id)} />
      )}
    </article>
  );
}
