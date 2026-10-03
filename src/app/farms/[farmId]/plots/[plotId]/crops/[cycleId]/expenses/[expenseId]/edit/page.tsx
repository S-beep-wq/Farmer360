import { Page, PageTitle } from "@/components/ui/layout";
import { removeExpenseAction, updateExpenseAction } from "@/features/crop-records/actions";
import { ExpenseForm, RemoveEntry } from "@/features/crop-records/components/RecordForms";
import { expenseFormValues } from "@/features/crop-records/form-values";
import { loadExpensePage } from "@/features/crop-records/page-data";
import { cropName } from "@/features/crops/format";

export default async function EditExpensePage({
  params,
}: PageProps<"/farms/[farmId]/plots/[plotId]/crops/[cycleId]/expenses/[expenseId]/edit">) {
  const { cycle, expense, recordIds, cropHref, locale, t, today } = await loadExpensePage(params);
  return (
    <Page>
      <PageTitle backHref={cropHref} backLabel={cropName(cycle.crop, locale)}>
        {t.records.editCostTitle}
      </PageTitle>
      <ExpenseForm t={t} action={updateExpenseAction.bind(null, recordIds)} today={today} initialValues={expenseFormValues(expense)} />
      <RemoveEntry t={t} action={removeExpenseAction.bind(null, recordIds)} />
    </Page>
  );
}
