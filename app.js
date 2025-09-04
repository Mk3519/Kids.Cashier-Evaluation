// Google Apps Script deployment URL (you'll need to replace this with your actual deployment URL)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRt3o6GrqKLFJ2wmftVW4cMfUNQA8pEoHsyGWowXchrsn__VKE30h42Vk6PucPiZom_Q/exec';

// دوال التحكم في عرض وإخفاء دائرة التحميل
function showLoader() {
    document.getElementById('loader').style.display = 'block';
    document.getElementById('cashierEvaluation').classList.add('form-disabled');
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('cashierEvaluation').classList.remove('form-disabled');
}

// دالة لجلب بيانات الموظفين من Google Sheets
async function fetchEmployees() {
    showLoader();
    try {
        console.log('Fetching employees from:', `${SCRIPT_URL}?action=getEmployees`);
        const response = await fetch(`${SCRIPT_URL}?action=getEmployees`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!data.success || !Array.isArray(data.data)) {
            throw new Error('Invalid response format');
        }
        
        console.log('Received employees data:', data);
        return data.data;
    } catch (error) {
        console.error('Error fetching employees:', error);
        showMessage('حدث خطأ في جلب بيانات الموظفين: ' + error.message, 'error');
        return [];
    } finally {
        hideLoader();
    }
}

// تحديث قائمة الموظفين في النموذج
async function populateEmployeeDropdown() {
    const employeeSelect = document.getElementById('employeeName');
    employeeSelect.innerHTML = '<option value="">Choose Employee</option>';
    
    try {
        const employees = await fetchEmployees();
        if (Array.isArray(employees) && employees.length > 0) {
            employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.code; // استخدام كود الموظف كقيمة
                option.textContent = `${employee.name} - ${employee.title}`; // عرض الاسم والمسمى الوظيفي
                employeeSelect.appendChild(option);
            });
        } else {
            showMessage('لا يوجد موظفين في القائمة', 'error');
        }
    } catch (error) {
        console.error('Error populating employee dropdown:', error);
        showMessage('خطأ في تحميل قائمة الموظفين', 'error');
    }
}

// تحميل بيانات الموظفين عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    populateEmployeeDropdown();
});

// Handle form submission
document.getElementById('cashierEvaluation').addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoader();
    
    const employeeName = document.getElementById('employeeName').value;
    const shortageAmount = document.getElementById('shortageAmount').value || 0;
    const surplusAmount = document.getElementById('surplusAmount').value || 0;
    const exitSheetMissing = document.getElementById('exitSheetMissing').value || 0;
    const cancelAmount = document.getElementById('cancelAmount').value || 0;
    
    if (!employeeName) {
        showMessage('Please select an employee', 'error');
        return;
    }

    // Find selected employee data
    const employees = await fetchEmployees();
    const selectedEmployee = employees.find(emp => emp.code === employeeName);
    
    if (!selectedEmployee) {
        showMessage('Employee data not found', 'error');
        return;
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                employeeName: selectedEmployee.name,
                employeeCode: selectedEmployee.code,
                employeeTitle: selectedEmployee.title,
                shortageAmount: parseFloat(shortageAmount),
                surplusAmount: parseFloat(surplusAmount),
                exitSheetMissing: parseInt(exitSheetMissing),
                cancelAmount: parseFloat(cancelAmount),
                date: new Date().toISOString()
            })
        });

        showMessage('Evaluation saved successfully', 'success');
        resetForm();
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error saving data', 'error');
    } finally {
        hideLoader();
    }
});

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 3000);
}

function resetForm() {
    document.getElementById('cashierEvaluation').reset();
}