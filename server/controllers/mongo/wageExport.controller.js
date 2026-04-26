import ExcelJS from 'exceljs';
import { Firm } from '../../models/index.js';

/**
 * Export wages to a highly formatted Excel file based on provided UI data
 * POST /api/wages/export
 */
export async function exportWagesToExcel(req, res) {
  try {
    const { month, data: rawData } = req.body;
    const firmId = req.user.firm_id;

    if (!month || !rawData || !Array.isArray(rawData)) {
      return res.status(400).json({ success: false, message: 'Month and data array are required' });
    }

    // Fetch firm details for branding
    const firm = await Firm.findById(firmId).lean();

    // 1. Create Workbook & Worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payroll Statement');

    // 2. Define Columns
    worksheet.columns = [
      { header: 'S.NO', key: 'sno', width: 6 },
      { header: 'EMPLOYEE NAME', key: 'name', width: 30 },
      { header: 'PROJECT / SITE', key: 'project', width: 25 },
      { header: 'BANK ACCOUNT', key: 'bank', width: 35 },
      { header: 'RATE', key: 'rate', width: 12 },
      { header: 'DAYS', key: 'days', width: 10 },
      { header: 'GROSS SALARY', key: 'gross', width: 15 },
      { header: 'EPF (12%)', key: 'epf', width: 12 },
      { header: 'ESIC (0.75%)', key: 'esic', width: 12 },
      { header: 'OTHER DED', key: 'other_ded', width: 12 },
      { header: 'OTHER BEN', key: 'other_ben', width: 12 },
      { header: 'ADVANCE', key: 'adv', width: 12 },
      { header: 'NET SALARY', key: 'net', width: 15 },
    ];

    // Styles
    const headerGradient = {
      type: 'gradient',
      gradient: 'angle',
      angle: 90,
      stops: [
        { position: 0, color: { argb: 'FF1E293B' } }, // Slate-900
        { position: 1, color: { argb: 'FF334155' } }  // Slate-700
      ]
    };

    const companyGradient = {
      type: 'gradient',
      gradient: 'angle',
      angle: 0,
      stops: [
        { position: 0, color: { argb: 'FF4F46E5' } }, // Indigo-600
        { position: 1, color: { argb: 'FF9333EA' } }  // Purple-600
      ]
    };

    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' }, size: 10 },
      fill: headerGradient,
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    };

    const borderStyle = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    // 3. Add Company Header
    worksheet.insertRow(1, [(firm?.name || 'Payroll Statement').toUpperCase()]);
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.height = 30;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = companyGradient;

    worksheet.insertRow(2, [`PAYROLL STATEMENT FOR ${month}`]);
    worksheet.mergeCells('A2:M2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.height = 20;
    subtitleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    subtitleCell.fill = companyGradient;
    
    worksheet.insertRow(3, []); // Gap

    // 4. Set Table Headers (Row 4)
    const tableHeaderRow = worksheet.getRow(4);
    tableHeaderRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // 5. Add Data Rows
    let currentRowIndex = 5;
    rawData.forEach((item, index) => {
      const row = worksheet.addRow({
        sno: index + 1,
        name: item.employee_name,
        project: `${item.project} - ${item.site}`,
        bank: `${item.bank} (A/C ${item.account_no})`,
        rate: item.p_day_wage,
        days: item.wage_days,
        gross: { formula: `E${currentRowIndex}*F${currentRowIndex}`, result: item.gross_salary },
        epf: item.epf_deduction,
        esic: item.esic_deduction,
        other_ded: item.other_deduction,
        other_ben: item.other_benefit,
        adv: item.advance_deduction,
        net: { 
          formula: `G${currentRowIndex}-(H${currentRowIndex}+I${currentRowIndex}+J${currentRowIndex}+L${currentRowIndex})+K${currentRowIndex}`, 
          result: item.net_salary 
        }
      });

      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle' };
        if (colNumber >= 5) {
          cell.numFmt = '#,##0.00';
          cell.alignment.horizontal = 'right';
        }
      });

      const netCell = row.getCell('net');
      netCell.font = { bold: true, color: { argb: '059669' } };
      netCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ECFDF5' } };

      currentRowIndex++;
    });

    // 6. Totals Row
    const totalRow = worksheet.addRow({
      name: 'TOTALS',
      gross: { formula: `SUM(G5:G${currentRowIndex - 1})` },
      epf: { formula: `SUM(H5:H${currentRowIndex - 1})` },
      esic: { formula: `SUM(I5:I${currentRowIndex - 1})` },
      other_ded: { formula: `SUM(J5:J${currentRowIndex - 1})` },
      other_ben: { formula: `SUM(K5:K${currentRowIndex - 1})` },
      adv: { formula: `SUM(L5:L${currentRowIndex - 1})` },
      net: { formula: `SUM(M5:M${currentRowIndex - 1})` }
    });

    totalRow.font = { bold: true };
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = borderStyle;
      if (colNumber >= 7) {
        cell.numFmt = '#,##0.00';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    });

    // 7. Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Wages_${month}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report' });
  }
}
