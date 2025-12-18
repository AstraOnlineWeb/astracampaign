import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ImportResult } from '../types';
import { apiService } from '../services/api';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CSVImportModal({ isOpen, onClose, onSuccess }: CSVImportModalProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error(t('csvImport.validation.invalidFile'));
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error(t('csvImport.validation.noFile'));
      return;
    }

    setIsUploading(true);
    try {
      const result = await apiService.importCSV(file);
      setImportResult(result);

      if (result.success) {
        toast.success(t('csvImport.result.successMessage', { count: result.successfulImports }));
        onSuccess();
      } else {
        toast(t('csvImport.result.partialMessage', { success: result.successfulImports, failed: result.failedImports }), {
          icon: '⚠️',
          style: {
            border: '1px solid #f59e0b',
            color: '#92400e',
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('csvImport.result.genericError');
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiService.downloadCSVTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template-contatos.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('csvImport.template.success'));
    } catch (error) {
      console.error('Erro ao baixar template:', error);
      toast.error(t('csvImport.template.error'));
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl border border-gray-100 my-8" role="dialog" aria-labelledby="import-title">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 id="import-title" className="text-xl font-bold text-gray-900">
                {t('csvImport.title')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('csvImport.subtitle')}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fechar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900 text-sm">{t('csvImport.template.title')}</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    {t('csvImport.template.description')}
                  </p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-2"
                  style={{ backgroundColor: 'var(--astra-dark-blue)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('csvImport.template.download')}
                </button>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 mb-2">
                {t('csvImport.selectFile')}
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="csv-file" className="cursor-pointer">
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600 font-medium">{t('csvImport.clickToSelect')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('csvImport.format')}</p>
                </label>
              </div>
              {file && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-green-700 font-medium truncate">
                      {file.name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Import Instructions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h3 className="font-medium text-gray-900 text-sm mb-2">ℹ️ {t('csvImport.instructions.title')}</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• {t('csvImport.instructions.required')}</li>
                <li>• {t('csvImport.instructions.optional')}</li>
                <li>• {t('csvImport.instructions.reference')}</li>
              </ul>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`border rounded-lg p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className={`font-medium text-sm mb-3 ${importResult.success ? 'text-green-900' : 'text-yellow-900'}`}>
                  {importResult.success ? '✅' : '⚠️'} {t('csvImport.result.title')}
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{importResult.totalRows}</div>
                    <div className="text-xs text-gray-600">{t('csvImport.result.total')}</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{importResult.successfulImports}</div>
                    <div className="text-xs text-gray-600">{t('csvImport.result.success')}</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-lg font-bold text-red-600">{importResult.failedImports}</div>
                    <div className="text-xs text-gray-600">{t('csvImport.result.errors')}</div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <details className="cursor-pointer">
                    <summary className="text-xs font-medium text-red-700 hover:text-red-800">{t('csvImport.result.viewErrors')} ({importResult.errors.length})</summary>
                    <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 max-h-32 overflow-y-auto">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-xs text-red-600 py-1">{error}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
            >
              {t('csvImport.buttons.close')}
            </button>
            <button
              onClick={handleImport}
              disabled={!file || isUploading}
              className="btn-primary flex-1 py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('csvImport.buttons.importing')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  {t('csvImport.buttons.import')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}