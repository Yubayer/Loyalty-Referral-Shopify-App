import { useState, useEffect } from "react";

/**
 * usePagination
 * @param {Array} data - Full dataset to paginate
 * @param {number} defaultPerPage - Items per page (default: 10)
 */
export function usePagination(data = [], defaultPerPage = 10) {
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(defaultPerPage);

    const totalItems = data.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

    // Reset to page 1 whenever perPage or data length changes
    useEffect(() => {
        setCurrentPage(1);
    }, [perPage, totalItems]);

    const startIndex = (currentPage - 1) * perPage;
    const paginatedData = data.slice(startIndex, startIndex + perPage);

    return {
        currentPage,
        setCurrentPage,
        perPage,
        setPerPage,
        totalPages,
        totalItems,
        paginatedData,
        startIndex,
    };
}