// إعداد عناوين الأعمدة عند تشغيل السكربت لأول مرة
function setupSheet(sheet) {
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
  }
  
  // Set column headers
  sheet.getRange("A1:F1").setValues([["Date & Time", "Employee Name", "Shortage Amount", "Surplus Amount", "Missing EXIT Receipts", "Cancel Amount"]]);
  
  // تنسيق عناوين الأعمدة
  const headerRange = sheet.getRange("A1:F1");
  headerRange.setBackground("#4CAF50");
  headerRange.setFontColor("white");
  headerRange.setFontWeight("bold");
  
  // تعيين عرض الأعمدة
  sheet.setColumnWidth(1, 150); // عمود التاريخ
  sheet.setColumnWidth(2, 150); // عمود اسم الموظف
  sheet.setColumnWidth(3, 120); // عمود العجز
  sheet.setColumnWidth(4, 120); // عمود الزيادة
  sheet.setColumnWidth(5, 200); // عمود الريسيد المفقود
}

// Function to handle all GET requests
function doGet(e) {
  const action = e.parameter.action;
  
  switch (action) {
    case 'getPerformance':
      return getPerformanceData(e.parameter.startDate, e.parameter.endDate);
      
    case 'getEmployees':
      const employees = getEmployees();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: employees
      })).setMimeType(ContentService.MimeType.JSON);
      
    default:
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Invalid action. Please specify a valid action parameter.'
      })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getPerformanceData(startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Data");
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!startDate || !endDate) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Start date and end date are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  
    // Get all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Filter by date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);
    
    // Convert dates to the same timezone
    start.setHours(0, 0, 0, 0);
    
    const filteredRows = rows.filter(row => {
      if (!row[0]) return false; // Skip empty rows
      const rowDate = new Date(row[0]);
      return rowDate >= start && rowDate <= end;
    });
    
    if (filteredRows.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        message: 'No data found for the selected date range'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Aggregate data by employee
    const employeeData = {};
    filteredRows.forEach(row => {
      const employee = row[1];
      if (!employeeData[employee]) {
        employeeData[employee] = {
          name: employee,
          shortageAmount: 0,
          surplusAmount: 0,
          missingExitReceipts: 0,
          cancelAmount: 0,
          count: 0,
          score: 100 // بداية بأعلى درجة
        };
      }
      
      employeeData[employee].shortageAmount += Number(row[2]) || 0;
      employeeData[employee].surplusAmount += Number(row[3]) || 0;
      employeeData[employee].missingExitReceipts += Number(row[4]) || 0;
      employeeData[employee].cancelAmount += Number(row[5]) || 0;
      employeeData[employee].count++;
      
      // حساب النتيجة
      let score = 100;
      
      // خصم نقاط العجز (40%)
      const shortageDeduction = Math.min(40, (employeeData[employee].shortageAmount / 100) * 5);
      score -= shortageDeduction;
      
      // خصم نقاط الزيادة (20%)
      const surplusDeduction = Math.min(20, (employeeData[employee].surplusAmount / 100) * 2);
      score -= surplusDeduction;
      
      // خصم نقاط الإيصالات المفقودة (25%)
      const receiptDeduction = Math.min(25, employeeData[employee].missingExitReceipts * 5);
      score -= receiptDeduction;
      
      // خصم نقاط الإلغاء (15%)
      const cancelDeduction = Math.min(15, (employeeData[employee].cancelAmount / 100) * 1);
      score -= cancelDeduction;
      
      employeeData[employee].score = Math.max(0, Math.round(score));
    });

    // Return totals and score
    const result = Object.values(employeeData).map(emp => ({
      name: emp.name,
      shortageAmount: Number(emp.shortageAmount.toFixed(2)),
      surplusAmount: Number(emp.surplusAmount.toFixed(2)),
      missingExitReceipts: Number(emp.missingExitReceipts.toFixed(0)),
      cancelAmount: Number(emp.cancelAmount.toFixed(2)),
      score: emp.score
    }));
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Error processing data: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
    
    // التحقق من وجود عناوين الأعمدة
    if (sheet.getRange("A1").getValue() === "") {
      setupSheet(sheet);
    }
    
    // تحليل البيانات الواردة
    const data = JSON.parse(e.postData.contents);
    
    // تنسيق التاريخ والوقت
    const date = new Date(data.date);
    const formattedDate = Utilities.formatDate(date, "GMT+2", "yyyy-MM-dd HH:mm:ss");
    
    // إضافة صف جديد بالبيانات
    const newRow = [
      formattedDate,
      data.employeeName,
      data.shortageAmount || 0,
      data.surplusAmount || 0,
      data.exitSheetMissing || 0,
      data.cancelAmount || 0
    ];
    
    sheet.appendRow(newRow);
    
    // تنسيق الصف الجديد
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(`A${lastRow}:F${lastRow}`);
    dataRange.setHorizontalAlignment("center");
    
    // تنسيق الأرقام في الأعمدة
    sheet.getRange(`C${lastRow}:D${lastRow}`).setNumberFormat("#,##0.00");
    sheet.getRange(`E${lastRow}`).setNumberFormat("#,##0");
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'message': 'Data saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': 'Error: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// دالة لحساب إجمالي التقييم لكل موظف
function calculateEmployeeStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Data");
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("لا توجد صفحة Data!");
    return;
  }
  
  const statsSheet = ss.getSheetByName("إحصائيات الموظفين") || ss.insertSheet("إحصائيات الموظفين");
  
  // إعداد صفحة الإحصائيات
  statsSheet.clear();
  statsSheet.getRange("A1:F1").setValues([["اسم الموظف", "إجمالي العجز", "إجمالي الزيادة", "إجمالي الريسيد المفقود", "إجمالي الكانسل", "آخر تحديث"]]);
  
  // الحصول على جميع البيانات
  const data = sheet.getDataRange().getValues();
  const employees = {};
  
  // تجميع البيانات لكل موظف
  for(let i = 1; i < data.length; i++) {
    const row = data[i];
    const employeeName = row[1];
    
    if(!employees[employeeName]) {
      employees[employeeName] = {
        shortageTotal: 0,
        surplusTotal: 0,
        exitMissingTotal: 0,
        cancelTotal: 0,
        lastUpdate: row[0]
      };
    }
    
    employees[employeeName].shortageTotal += Number(row[2]);
    employees[employeeName].surplusTotal += Number(row[3]);
    employees[employeeName].exitMissingTotal += Number(row[4]);
    employees[employeeName].cancelTotal += Number(row[5] || 0);
    employees[employeeName].lastUpdate = row[0];
  }
  
  // إضافة البيانات إلى صفحة الإحصائيات
  Object.entries(employees).forEach(([name, stats], index) => {
    statsSheet.getRange(index + 2, 1, 1, 6).setValues([[
      name,
      stats.shortageTotal,
      stats.surplusTotal,
      stats.exitMissingTotal,
      stats.cancelTotal,
      stats.lastUpdate
    ]]);
  });
  
  // تنسيق صفحة الإحصائيات
  const headerRange = statsSheet.getRange("A1:E1");
  headerRange.setBackground("#4CAF50");
  headerRange.setFontColor("white");
  headerRange.setFontWeight("bold");
  
  statsSheet.setColumnWidths(1, 5, 150);
  statsSheet.getRange(2, 2, statsSheet.getLastRow() - 1, 2).setNumberFormat("#,##0.00");
  statsSheet.getRange(2, 4, statsSheet.getLastRow() - 1, 1).setNumberFormat("#,##0");
}

// دالة للحصول على بيانات الموظفين
function getEmployees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const employeeSheet = ss.getSheetByName("Employee");
  
  if (!employeeSheet) {
    return [];
  }
  
  const data = employeeSheet.getDataRange().getValues();
  // تجاهل الصف الأول (عناوين الأعمدة)
  const employees = data.slice(1)
    .filter(row => row[0] && row[1]) // تأكد من وجود الكود والاسم
    .map(row => ({
      code: row[0].toString(),
      name: row[1],
      title: row[2] || ''
    }));
  
  return employees;
}

// إنشاء قائمة مخصصة في جدول البيانات
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('تقييم الكاشير')
    .addItem('تحديث إحصائيات الموظفين', 'calculateEmployeeStats')
    .addToUi();
}