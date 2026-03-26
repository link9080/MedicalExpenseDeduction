

function doPost(e) {

  try {
    const params = JSON.parse(e.postData.contents);
    debugLog("doPost開始：" + JSON.stringify(params));
    const props = PropertiesService.getScriptProperties();
    const FOLDER_ID = props.getProperty('FOLDER_ID');
    const apiKey = props.getProperty('GEMINI_API_KEY');

    // パスワードチェックのログ
    console.log("Action: " + params.action);

    if (params.pass !== props.getProperty('APP_PASSWORD')) {
      debugLog("認証失敗");
      return errorRes("認証エラー");
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // --- モード1: 解析 (画像を受け取り、AIの結果だけ返す) ---
    if (params.action === "analyze") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [
            { text: "医療費控除用。画像から『購入場所、対象商品1つの名称、合計金額、購入日』を抽出し、以下のJSON形式のみで返してください：{\"store\": \"\", \"itemName\": \"\", \"price\": 0, \"date\": \"YYYY/MM/DD\"}" },
            { inline_data: { mime_type: "image/jpeg", data: params.imageBase64 } }
          ]
        }]
      };

      const res = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
      const responseCode = res.getResponseCode();
      const responseBody = res.getContentText();

      debugLog("Gemini Status Code: " + responseCode);
      debugLog("Gemini Body: " + responseBody);
      if (responseCode !== 200) {
        return errorRes(res.getResponseCode() === 429 ? "Gemini無料枠制限です" : "Geminiエラー");
      }
      // 成功時のデータ解析
      try {
        const resJson = JSON.parse(responseBody);
        const resultText = resJson.candidates[0].content.parts[0].text;
        // マークダウンの除去
        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        const aiData = JSON.parse(cleanJson);

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          data: aiData
        })).setMimeType(ContentService.MimeType.JSON);

      } catch (e) {
        debugLog("JSON解析失敗: " + e.toString());
        return errorRes("AIの回答形式が正しくありませんでした。");
      }

    }

    // --- モード2: 最終登録 (画像とテキストを同時に受け取り、保存する) ---
    if (params.action === "register") {
      const folder = DriveApp.getFolderById(FOLDER_ID);

      // 電帳法を意識したファイル名規則: YYYYMMDD_金額_取引先.jpg
      // 例: 20260226_1500_スギ薬局.jpg
      const cleanDate = params.date.replace(/\//g, ""); // 2026/02/26 -> 20260226
      const fileName = `${cleanDate}_${params.price}_${params.store}.jpg`;

      const blob = Utilities.newBlob(Utilities.base64Decode(params.imageBaseBase64), "image/jpeg", fileName);
      const file = folder.createFile(blob);
      const fileUrl = file.getUrl();

      // スプレッドシート側も検索項目を明確に分ける
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      sheet.appendRow([
        params.date,    // 取引年月日
        params.price,   // 取引金額
        params.store,   // 取引先
        params.itemName,// 内容
        fileUrl,        // 画像リンク
        new Date()      // 登録日時（真実性の補足）
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 削除アクション (ファイルも消す) ---
    if (params.action === "delete") {
      try {

        const fileUrl = sheet.getRange(params.rowNum, 5).getValue();

        // 他の行でも同じURLが使われているかチェック
        const allUrls = sheet.getRange(2, 5, sheet.getLastRow(), 1).getValues().flat();
        const count = allUrls.filter(u => u === fileUrl).length;

        // 自分以外に使っている行がなければ、ファイルをゴミ箱へ
        if (count <= 1 && fileUrl) {
          const fileId = fileUrl.match(/[-\w]{25,}/);
          if (fileId) DriveApp.getFileById(fileId[0]).setTrashed(true);
        }

        sheet.deleteRow(params.rowNum);
        return successRes("削除完了");
      } catch (e) {
        debugLog("削除エラー: " + e.toString())
        return errorRes("ファイル削除に失敗しましたが、行は削除しました");
      }
    }
    // --- 編集アクション ---
    if (params.action === "update") {
      // A:日付, B:金額, C:先, D:品目 の順で更新
      sheet.getRange(params.rowNum, 1, 1, 4).setValues([[
        params.date,
        params.price,
        params.store,
        params.itemName
      ]]);
      return successRes("更新完了");
    }
  } catch (err) {
    // 予期せぬエラー（文法ミスなど）をキャッチ
    debugLog("致命的エラー: " + err.toString())
    return errorRes(err.toString());
  }
}

function doGet(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (e.parameter.pass !== props.getProperty('APP_PASSWORD')) return ContentService.createTextOutput("Auth Error");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // 名前で指定せず「一番左のシート」を読み込むようにすると確実
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1).map((row, index) => ({ rowNum: index + 2, date: row[0] ? Utilities.formatDate(new Date(row[0]), "JST", "yyyy/MM/dd") : "", price: row[1], store: row[2], itemName: row[3], fileUrl: row[4], registerDate: row[5] ? Utilities.formatDate(new Date(row[5]), "JST", "yyyy/MM/dd HH:mm") : "" }));
    console.log(rows)
    return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // 予期せぬエラー（文法ミスなど）をキャッチ
    debugLog("致命的エラー: " + err.toString())
    return errorRes(err.toString());
  }
}

function errorRes(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: msg })).setMimeType(ContentService.MimeType.JSON);
}
// 成功レスポンスを返す共通関数
function successRes(message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

// デバッグ用の関数
function debugLog(msg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("log");
  if (!sheet) sheet = ss.insertSheet("log");
  sheet.appendRow([new Date(), msg]);
}