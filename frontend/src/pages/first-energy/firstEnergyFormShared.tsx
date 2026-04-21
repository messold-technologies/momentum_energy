export function RequiredMark() {
  return <span className="text-red-600 ml-0.5">*</span>;
}

export function fieldClass(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-primary-500 ${
    hasError ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-primary-500'
  }`;
}

export function FieldError({ message }: { readonly message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
