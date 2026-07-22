/**
 * FinanceTracker - Dashboard Logic & API Integration
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let state = {
        transactions: [],
        filteredTransactions: [],
        selectedMonth: 'all',
        selectedTypeFilter: 'all',
        searchQuery: '',
        categoryChart: null,
        flowChart: null
    };

    // --- DOM Elements ---
    const monthFilter = document.getElementById('monthFilter');
    const totalBalanceEl = document.getElementById('totalBalance');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpensesEl = document.getElementById('totalExpenses');
    const totalCountEl = document.getElementById('totalCount');
    const incomeCountEl = document.getElementById('incomeCount');
    const expenseCountEl = document.getElementById('expenseCount');
    const balanceStatusBadge = document.getElementById('balanceStatusBadge');
    
    const transactionForm = document.getElementById('transactionForm');
    const txTypeInput = document.getElementById('txType');
    const typeBtns = document.querySelectorAll('.type-btn');
    const submitTxBtn = document.getElementById('submitTxBtn');

    const transactionTableBody = document.getElementById('transactionTableBody');
    const tableLoading = document.getElementById('tableLoading');
    const emptyTableState = document.getElementById('emptyTableState');
    const filteredCountBadge = document.getElementById('filteredCountBadge');

    const searchInput = document.getElementById('searchInput');
    const filterPills = document.querySelectorAll('.pill-btn');
    const toastContainer = document.getElementById('toastContainer');
    const quickAddBtn = document.getElementById('quickAddBtn');

    // --- Helper Functions ---
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(val);
    };

    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    const getCategoryIcon = (category) => {
        const map = {
            'Food': 'fa-utensils',
            'Salary': 'fa-money-bill-wave',
            'Housing': 'fa-house-chimney',
            'Shopping': 'fa-bag-shopping',
            'Bills': 'fa-bolt',
            'Entertainment': 'fa-film',
            'Transport': 'fa-car',
            'Investment': 'fa-chart-line-up'
        };
        return map[category] || 'fa-tag';
    };

    // --- API Calls ---
    const fetchTransactions = async () => {
        try {
            tableLoading.classList.remove('hidden');
            emptyTableState.classList.add('hidden');

            const res = await fetch('/transactions');
            if (!res.ok) throw new Error('Failed to fetch transactions');

            const data = await res.json();
            state.transactions = data.transactions || [];
            applyFilters();
        } catch (err) {
            showToast(err.message, 'error');
            state.transactions = [];
            applyFilters();
        } finally {
            tableLoading.classList.add('hidden');
        }
    };

    const fetchMonthlySummary = async (monthNum) => {
        try {
            const res = await fetch(`/summary/${monthNum}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            return null;
        }
    };

    const addTransaction = async (formData) => {
        try {
            submitTxBtn.disabled = true;
            submitTxBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

            const res = await fetch('/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok) {
                const errorMsg = data.details ? data.details.join(', ') : (data.error || 'Failed to add');
                throw new Error(errorMsg);
            }

            showToast('Transaction added successfully!', 'success');
            transactionForm.reset();
            // Reset type toggle to expense by default
            setTypeToggle('expense');
            await fetchTransactions();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitTxBtn.disabled = false;
            submitTxBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Transaction`;
        }
    };

    const deleteTransaction = async (id) => {
        if (!confirm(`Are you sure you want to delete transaction #${id}?`)) return;

        try {
            const res = await fetch(`/transactions/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete transaction');

            showToast(`Transaction #${id} deleted successfully.`, 'success');
            await fetchTransactions();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // --- Type Toggle Logic ---
    const setTypeToggle = (type) => {
        txTypeInput.value = type;
        typeBtns.forEach(btn => {
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    };

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => setTypeToggle(btn.dataset.type));
    });

    // --- Form Submit Event ---
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('txAmount').value);
        const category = document.getElementById('txCategory').value;
        const type = txTypeInput.value;

        if (!amount || amount <= 0) {
            showToast('Amount must be greater than 0', 'error');
            return;
        }

        if (!category) {
            showToast('Please select a category', 'error');
            return;
        }

        addTransaction({ amount, category, type });
    });

    // --- Filtering Logic ---
    const applyFilters = async () => {
        let items = [...state.transactions];

        // 1. Month Filter
        if (state.selectedMonth !== 'all') {
            const monthInt = parseInt(state.selectedMonth, 10);
            items = items.filter(t => {
                if (!t.date) return false;
                const d = new Date(t.date);
                return (d.getMonth() + 1) === monthInt;
            });
        }

        // 2. Type Filter (Income/Expense/All)
        if (state.selectedTypeFilter !== 'all') {
            items = items.filter(t => t.type === state.selectedTypeFilter);
        }

        // 3. Search Query
        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            items = items.filter(t => 
                t.category.toLowerCase().includes(q) ||
                t.type.toLowerCase().includes(q) ||
                t.amount.toString().includes(q)
            );
        }

        state.filteredTransactions = items;
        renderSummaryCards();
        renderTable();
        renderCharts();
    };

    // --- Render Summary Cards ---
    const renderSummaryCards = async () => {
        let totalIncome = 0;
        let totalExpenses = 0;
        let incomeCount = 0;
        let expenseCount = 0;

        if (state.selectedMonth !== 'all') {
            // Fetch month summary directly from API for accuracy
            const summary = await fetchMonthlySummary(parseInt(state.selectedMonth, 10));
            if (summary) {
                totalIncome = summary.total_income || 0;
                totalExpenses = summary.total_expenses || 0;
                incomeCount = summary.income_count || 0;
                expenseCount = summary.expense_count || 0;
            }
        } else {
            // Aggregate from all transactions in state
            state.transactions.forEach(t => {
                if (t.type === 'income') {
                    totalIncome += t.amount;
                    incomeCount++;
                } else if (t.type === 'expense') {
                    totalExpenses += t.amount;
                    expenseCount++;
                }
            });
        }

        const netBalance = totalIncome - totalExpenses;

        totalBalanceEl.textContent = formatCurrency(netBalance);
        totalIncomeEl.textContent = formatCurrency(totalIncome);
        totalExpensesEl.textContent = formatCurrency(totalExpenses);
        totalCountEl.textContent = state.transactions.length;
        incomeCountEl.textContent = incomeCount;
        expenseCountEl.textContent = expenseCount;

        // Balance badge status
        if (netBalance >= 0) {
            balanceStatusBadge.className = 'badge positive';
            balanceStatusBadge.innerHTML = `<i class="fa-solid fa-shield-heart"></i> Net Savings`;
        } else {
            balanceStatusBadge.className = 'badge negative';
            balanceStatusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Deficit`;
        }
    };

    // --- Render Transaction Table ---
    const renderTable = () => {
        transactionTableBody.innerHTML = '';
        filteredCountBadge.textContent = `${state.filteredTransactions.length} items`;

        if (state.filteredTransactions.length === 0) {
            emptyTableState.classList.remove('hidden');
            return;
        }

        emptyTableState.classList.add('hidden');

        state.filteredTransactions.forEach(t => {
            const tr = document.createElement('tr');
            const isIncome = t.type === 'income';
            const iconClass = getCategoryIcon(t.category);
            const formattedAmount = `${isIncome ? '+' : '-'}${formatCurrency(t.amount)}`;
            const amountColorClass = isIncome ? 'text-income' : 'text-expense';
            const typeBadgeClass = isIncome ? 'badge positive' : 'badge negative';

            tr.innerHTML = `
                <td><strong>#${t.id}</strong></td>
                <td><i class="fa-regular fa-clock text-muted"></i> ${t.date}</td>
                <td>
                    <span class="category-tag">
                        <i class="fa-solid ${iconClass}"></i> ${t.category}
                    </span>
                </td>
                <td>
                    <span class="${typeBadgeClass}">
                        ${t.type.toUpperCase()}
                    </span>
                </td>
                <td class="text-right ${amountColorClass}">
                    <strong>${formattedAmount}</strong>
                </td>
                <td class="text-center">
                    <button class="btn-delete" data-id="${t.id}" title="Delete transaction">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            tr.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(t.id));
            transactionTableBody.appendChild(tr);
        });
    };

    // --- Render Charts (Chart.js) ---
    const renderCharts = () => {
        // 1. Expense Breakdown Doughnut Chart
        const expenseMap = {};
        const activeTransactions = state.selectedMonth !== 'all' ? state.filteredTransactions : state.transactions;

        activeTransactions.forEach(t => {
            if (t.type === 'expense') {
                expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
            }
        });

        const categories = Object.keys(expenseMap);
        const amounts = Object.values(expenseMap);
        const noChartData = document.getElementById('noChartData');
        const categoryCanvas = document.getElementById('categoryChart');

        if (categories.length === 0) {
            noChartData.classList.remove('hidden');
            categoryCanvas.classList.add('hidden');
        } else {
            noChartData.classList.add('hidden');
            categoryCanvas.classList.remove('hidden');

            const ctx = categoryCanvas.getContext('2d');
            if (state.categoryChart) state.categoryChart.destroy();

            state.categoryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categories,
                    datasets: [{
                        data: amounts,
                        backgroundColor: [
                            '#f43f5e', '#6366f1', '#10b981', '#38bdf8',
                            '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'
                        ],
                        borderWidth: 2,
                        borderColor: '#161b22'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { color: '#c9d1d9', font: { family: 'Plus Jakarta Sans', size: 12 } }
                        }
                    },
                    cutout: '70%'
                }
            });
        }

        // 2. Cash Flow Comparison Bar Chart
        let incTotal = 0;
        let expTotal = 0;

        activeTransactions.forEach(t => {
            if (t.type === 'income') incTotal += t.amount;
            if (t.type === 'expense') expTotal += t.amount;
        });

        const flowCanvas = document.getElementById('flowChart').getContext('2d');
        if (state.flowChart) state.flowChart.destroy();

        state.flowChart = new Chart(flowCanvas, {
            type: 'bar',
            data: {
                labels: ['Income', 'Expenses'],
                datasets: [{
                    label: 'Amount ($)',
                    data: [incTotal, expTotal],
                    backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(244, 63, 94, 0.7)'],
                    borderColor: ['#10b981', '#f43f5e'],
                    borderWidth: 1.5,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e', font: { family: 'Plus Jakarta Sans' } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#8b949e', font: { family: 'Plus Jakarta Sans' } }
                    }
                }
            }
        });
    };

    // --- Controls Listeners ---
    monthFilter.addEventListener('change', (e) => {
        state.selectedMonth = e.target.value;
        applyFilters();
    });

    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        applyFilters();
    });

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            state.selectedTypeFilter = pill.dataset.filter;
            applyFilters();
        });
    });

    quickAddBtn.addEventListener('click', () => {
        document.getElementById('txAmount').focus();
        window.scrollTo({ top: document.querySelector('.form-panel').offsetTop - 20, behavior: 'smooth' });
    });

    // Initial Load
    fetchTransactions();
});
