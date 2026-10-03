import { Page, PageTitle } from "@/components/ui/layout";
import { createExpenseAction } from "@/features/crop-records/actions";
import { ExpenseForm } from "@/features/crop-records/components/RecordForms";
import { loadRecordPage } from "@/features/crop-records/page-data";
import { cropName } from "@/features/crops/format";

export default async function NewExpensePage({ params }: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/expenses/new">) {
  const { cycle, ids, cropHref, locale, t, today } = await loadRecordPage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.records.newCostTitle}
      </PageTitle>
      <ExpenseForm t={t} action={createExpenseAction.bind(null, ids)} today={today} initialValues={{ expense_date: today }} />
    </Page>
  );
}
