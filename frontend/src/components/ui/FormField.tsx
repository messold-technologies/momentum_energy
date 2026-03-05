import type { FieldError } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  error?: FieldError;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

export default function FormField({ label, error, required, children, hint }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger-500">{error.message}</p>}
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-500';

export const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors bg-white';

export const errorInputClass =
  'w-full px-3 py-2 border border-danger-500 rounded-lg text-sm focus:ring-2 focus:ring-danger-500 focus:border-danger-500 outline-none transition-colors';
