import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';

interface PerfexLead {
  id: string;
  hash: string;
  name: string;
  title: string;
  company: string;
  description: string;
  country: string;
  zip: string;
  city: string;
  state: string;
  address: string;
  assigned: string;
  dateadded: string;
  from_form_id: string;
  status: string;
  source: string;
  lastcontact: string;
  dateassigned: string;
  last_status_change: string;
  addedfrom: string;
  email: string;
  website: string;
  leadorder: string;
  phonenumber: string;
  date_converted: string;
  lost: string;
  junk: string;
  last_lead_status: string;
  is_imported_from_email_integration: string;
  email_integration_uid: string;
  is_public: string;
  default_language: string;
  // Campos adicionais
  status_name?: string;
  source_name?: string;
  client_id?: string;
  lead_value?: string;
}

interface PerfexImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PerfexImportModal({ isOpen, onClose, onSuccess }: PerfexImportModalProps) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<PerfexLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<PerfexLead[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    company: '',
    status: '',
    source: '',
    country: '',
    city: '',
    state: ''
  });

  // Valores únicos para filtros select
  const [uniqueValues, setUniqueValues] = useState({
    statuses: [] as string[],
    sources: [] as string[],
    countries: [] as string[],
    cities: [] as string[],
    states: [] as string[]
  });

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories();
      const categoriesData = response.categories || [];
      setCategories(categoriesData);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error(t('common.error'));
      setCategories([]);
    }
  };

  const loadLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const response = await apiService.getPerfexLeads();
      const leadsData = response.leads || [];
      setLeads(leadsData);
      setFilteredLeads(leadsData);

      // Extrair valores únicos para os filtros (usando nomes legíveis quando disponíveis)
      const statuses = [...new Set(leadsData.map((l: PerfexLead) => l.status_name || l.status).filter(Boolean))];
      const sources = [...new Set(leadsData.map((l: PerfexLead) => l.source_name || l.source).filter(Boolean))];
      const countries = [...new Set(leadsData.map((l: PerfexLead) => l.country).filter(Boolean))];
      const cities = [...new Set(leadsData.map((l: PerfexLead) => l.city).filter(Boolean))];
      const states = [...new Set(leadsData.map((l: PerfexLead) => l.state).filter(Boolean))];

      setUniqueValues({ statuses, sources, countries, cities, states });

      if (leadsData.length === 0) {
        toast(t('perfexImport.messages.noLeads'), { icon: 'ℹ️' });
      } else {
        toast.success(t('common.success'));
      }
    } catch (error: any) {
      console.error('Erro ao carregar leads do Perfex:', error);
      const errorMessage = error.message || t('common.error');

      if (errorMessage.includes('não configurado')) {
        toast.error(t('perfexImport.messages.configError'), { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leads];

    if (filters.name) {
      filtered = filtered.filter(lead =>
        lead.name?.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.email) {
      filtered = filtered.filter(lead =>
        lead.email?.toLowerCase().includes(filters.email.toLowerCase())
      );
    }

    if (filters.company) {
      filtered = filtered.filter(lead =>
        lead.company?.toLowerCase().includes(filters.company.toLowerCase())
      );
    }

    if (filters.status) {
      filtered = filtered.filter(lead =>
        (lead.status_name || lead.status) === filters.status
      );
    }

    if (filters.source) {
      filtered = filtered.filter(lead =>
        (lead.source_name || lead.source) === filters.source
      );
    }

    if (filters.country) {
      filtered = filtered.filter(lead => lead.country === filters.country);
    }

    if (filters.city) {
      filtered = filtered.filter(lead => lead.city === filters.city);
    }

    if (filters.state) {
      filtered = filtered.filter(lead => lead.state === filters.state);
    }

    setFilteredLeads(filtered);
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      email: '',
      company: '',
      status: '',
      source: '',
      country: '',
      city: '',
      state: ''
    });
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const selectAllFiltered = () => {
    const newSelected = new Set<string>();
    filteredLeads.forEach(lead => newSelected.add(lead.id));
    setSelectedLeads(newSelected);
  };

  const deselectAll = () => {
    setSelectedLeads(new Set());
  };

  const handleImport = async () => {
    if (selectedLeads.size === 0) {
      toast.error(t('perfexImport.messages.selectLead'));
      return;
    }

    if (!selectedCategoryId) {
      toast.error(t('perfexImport.messages.selectCategory'));
      return;
    }

    setIsImporting(true);
    try {
      const response = await apiService.importPerfexLeads(
        Array.from(selectedLeads),
        selectedCategoryId
      );

      toast.success(
        t('perfexImport.messages.success', { imported: response.imported, updated: response.updated })
      );

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setLeads([]);
    setFilteredLeads([]);
    setSelectedLeads(new Set());
    setSelectedCategoryId('');
    clearFilters();
    onClose();
  };

  // Effects
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [filters, leads]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl border border-gray-100 my-8 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {t('perfexImport.title')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('perfexImport.subtitle')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={t('common.close')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Botão Carregar Leads */}
          <div className="flex justify-between items-center gap-4">
            <button
              onClick={loadLeads}
              disabled={isLoadingLeads}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingLeads ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('perfexImport.loading')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {leads.length > 0 ? t('perfexImport.updateLeads') : t('perfexImport.loadLeads')}
                </>
              )}
            </button>

            {leads.length > 0 && (
              <div className="text-sm text-gray-600">
                {t('perfexImport.stats', { filtered: filteredLeads.length, total: leads.length, selected: selectedLeads.size })}
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        {leads.length > 0 && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900 text-sm">{t('perfexImport.filters.title')}</h3>
              <button
                onClick={clearFilters}
                className="text-xs text-purple-600 hover:text-purple-700"
              >
                {t('perfexImport.filters.clear')}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <input
                type="text"
                placeholder={t('perfexImport.filters.name')}
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder={t('perfexImport.filters.email')}
                value={filters.email}
                onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder={t('perfexImport.filters.company')}
                value={filters.company}
                onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('perfexImport.filters.status')}</option>
                {uniqueValues.statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('perfexImport.filters.source')}</option>
                {uniqueValues.sources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
              <select
                value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('perfexImport.filters.country')}</option>
                {uniqueValues.countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <select
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('perfexImport.filters.city')}</option>
                {uniqueValues.cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <select
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('perfexImport.filters.state')}</option>
                {uniqueValues.states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Lista de Leads */}
        <div className="flex-1 overflow-y-auto p-6">
          {leads.length === 0 && !isLoadingLeads && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-medium text-purple-900 text-sm mb-2">ℹ️ {t('perfexImport.instructions.title')}</h3>
              <ul className="text-xs text-purple-700 space-y-1">
                {t<string[]>('perfexImport.instructions.steps', { returnObjects: true }).map((step: string, index: number) => (
                  <li key={index}>• {step}</li>
                ))}
              </ul>
            </div>
          )}

          {filteredLeads.length > 0 && (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={selectAllFiltered}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                >
                  {t('perfexImport.buttons.selectAll', { count: filteredLeads.length })}
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                >
                  {t('perfexImport.buttons.deselectAll')}
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                          <input type="checkbox" className="opacity-0" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">{t('perfexImport.columns.name')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">{t('perfexImport.columns.email')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">{t('perfexImport.columns.phone')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">{t('perfexImport.columns.company')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">{t('perfexImport.columns.status')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">{t('perfexImport.columns.source')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className={`hover:bg-gray-50 ${selectedLeads.has(lead.id) ? 'bg-purple-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedLeads.has(lead.id)}
                              onChange={() => toggleLeadSelection(lead.id)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.name || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.email || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.phonenumber || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.company || '-'}</td>
                          <td className="px-4 py-3">
                            {(lead.status_name || lead.status) && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {lead.status_name || lead.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{lead.source_name || lead.source || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer - Seleção de Categoria e Ações */}
        {leads.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                {t('perfexImport.targetCategory')}:
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('perfexImport.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
              >
                {t('perfexImport.buttons.close')}
              </button>
              <button
                onClick={handleImport}
                disabled={selectedLeads.size === 0 || !selectedCategoryId || isImporting}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('perfexImport.buttons.importing')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {t('perfexImport.buttons.import', { count: selectedLeads.size })}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
