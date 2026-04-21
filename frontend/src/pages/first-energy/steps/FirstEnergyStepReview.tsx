import { useFormContext } from 'react-hook-form';
import { Eye } from 'lucide-react';
import type { FormValues } from '../firstEnergyFormSchema';
import { useFirstEnergyWizard } from '../FirstEnergyWizardContext';

export function FirstEnergyStepReview() {
  const methods = useFormContext<FormValues>();
  const w = useFirstEnergyWizard();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Review</h2>
          <p className="text-sm text-gray-500 mt-1">Preview the payload that will be submitted to `/accounts`.</p>
        </div>
        <button
          type="button"
          onClick={w.handlePreview}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-200 rounded-lg hover:bg-primary-50 cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
      </div>
      <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-[420px]">
        {JSON.stringify(w.buildAccountPayload(methods.getValues()), null, 2)}
      </pre>
    </section>
  );
}
