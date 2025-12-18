import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav className="flex items-center justify-center space-x-1" aria-label={t('pagination.page')}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={t('pagination.previous')}
      >
        {t('pagination.previous')}
      </button>

      {visiblePages.map((page, index) => (
        <Fragment key={index}>
          {page === '...' ? (
            <span className="px-3 py-2 text-sm font-medium text-gray-500">...</span>
          ) : (
            <button
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 ${currentPage === page
                  ? 'text-white hover:opacity-90'
                  : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              style={currentPage === page ? {
                backgroundColor: 'var(--astra-dark-blue)'
              } : undefined}
              aria-label={`${t('pagination.page')} ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )}
        </Fragment>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={t('pagination.next')}
      >
        {t('pagination.next')}
      </button>
    </nav>
  );
}