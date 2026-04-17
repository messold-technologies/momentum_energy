import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Zap } from 'lucide-react';
import { useCompany, type CompanyId } from '../contexts/CompanyContext';

const OPTIONS: ReadonlyArray<{
  id: CompanyId;
  title: string;
  description: string;
  icon: typeof Zap;
}> = [
  {
    id: 'momentum',
    title: 'Momentum Energy',
    description: 'Sales capture and submission for Momentum.',
    icon: Zap,
  },
  {
    id: 'first-energy',
    title: '1st Energy',
    description: 'Sales capture and submission for 1st Energy.',
    icon: Building2,
  },
];

export default function SelectCompanyPage() {
  const navigate = useNavigate();
  const { setCompany, clearCompany } = useCompany();

  useEffect(() => {
    clearCompany();
  }, [clearCompany]);

  function choose(id: CompanyId) {
    setCompany(id);
    if (id === 'momentum') {
      navigate('/', { replace: true });
    } else {
      navigate('/first-energy/transactions/new', { replace: true });
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 text-center">Choose retailer</h1>
      <p className="text-sm text-gray-500 text-center mt-2 max-w-lg mx-auto">
        Select which company you are working with. After you choose, navigation appears in the sidebar.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPTIONS.map(({ id, title, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            className="text-left bg-white rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
              <Icon className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
