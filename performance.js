// Google Apps Script deployment URL
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRt3o6GrqKLFJ2wmftVW4cMfUNQA8pEoHsyGWowXchrsn__VKE30h42Vk6PucPiZom_Q/exec';

// Show/Hide loader functions
function showLoader() {
    document.getElementById('loader').style.display = 'block';
    document.getElementById('loaderOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden'; // منع التمرير أثناء التحميل
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('loaderOverlay').style.display = 'none';
    document.body.style.overflow = 'auto'; // السماح بالتمرير مرة أخرى
}

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'message';
    }, 3000);
}

// Calculate employee score based on metrics
function calculateScore(employee) {
    let score = 100;
    
    // خصم نقاط العجز (40%)
    const shortageDeduction = Math.min(40, (employee.shortageAmount / 100) * 5);
    score -= shortageDeduction;
    
    // خصم نقاط الزيادة (20%)
    const surplusDeduction = Math.min(20, (employee.surplusAmount / 100) * 2);
    score -= surplusDeduction;
    
    // خصم نقاط الإيصالات المفقودة (25%)
    const receiptDeduction = Math.min(25, employee.missingExitReceipts * 5);
    score -= receiptDeduction;
    
    // خصم نقاط الإلغاء (15%)
    const cancelDeduction = Math.min(15, (employee.cancelAmount / 100) * 1);
    score -= cancelDeduction;
    
    return Math.max(0, Math.round(score)); // Ensure score is between 0 and 100
}

// Format date to match the expected format in Google Apps Script
function formatDate(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

// Fetch and display performance data
async function fetchPerformanceData() {
    showLoader();
    
    let startDate = document.getElementById('startDate').value;
    let endDate = document.getElementById('endDate').value;
    
    // Format dates
    startDate = formatDate(startDate);
    endDate = formatDate(endDate);

    if (!startDate || !endDate) {
        showMessage('Please select both start and end dates', 'error');
        hideLoader();
        return;
    }

    try {
        const url = `${SCRIPT_URL}?action=getPerformance&startDate=${startDate}&endDate=${endDate}`;
        console.log('Fetching data from:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }

        if (data.message) {
            document.getElementById('performanceData').innerHTML = `<tr><td colspan="7">${data.message}</td></tr>`;
            hideLoader();
            return;
        }

        if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
            document.getElementById('performanceData').innerHTML = '<tr><td colspan="7">No data found for the selected date range</td></tr>';
            hideLoader();
            return;
        }

        // Use data.data instead of data
        const performanceData = data.data;

        // Sort employees by their scores (which are now coming from the server)
        const rankedEmployees = performanceData.sort((a, b) => b.score - a.score);

        // Display the data
        const tbody = document.getElementById('performanceData');
        tbody.innerHTML = '';

        rankedEmployees.forEach((emp, index) => {
            const row = document.createElement('tr');
            
            // Add ranking-based class
            if (index === 0) row.classList.add('rank-1');
            if (index === 1) row.classList.add('rank-2');
            if (index === 2) row.classList.add('rank-3');

            row.innerHTML = `
                <td class="rank-column">${index + 1}</td>
                <td>${emp.name}</td>
                <td class="number-cell">${emp.shortageAmount.toFixed(2)}</td>
                <td class="number-cell">${emp.surplusAmount.toFixed(2)}</td>
                <td class="number-cell">${emp.missingExitReceipts}</td>
                <td class="number-cell">${emp.cancelAmount.toFixed(2)}</td>
                <td class="number-cell">${emp.score.toFixed(1)}%</td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching performance data:', error);
        const errorMessage = error.message || 'Error fetching performance data';
        document.getElementById('performanceData').innerHTML = `<tr><td colspan="7" style="color: red;">Error: ${errorMessage}</td></tr>`;
        showMessage(errorMessage, 'error');
    } finally {
        hideLoader();
    }
}

// Set default date range (current month)
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
    
    fetchPerformanceData();
});
