/**
 * 医療費控除DX - Core Logic
 */
// --- HTMLから直接呼ばれる関数を window に登録 ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbyiIRmPuoln0Xx3ShJXp4jqExBsT3CgPa_DjMsbKTXWpck789OomVGVAxoa3QDZSH9ohg/exec";
let lastImageBase64 = "";
let datePicker, dateDisplay; // ここで宣言
window.savePass = function () {
    localStorage.setItem('my_app_pass', document.getElementById('appPass').value);
    alert("パスワードを保存しました");
};

window.showPage = function (p) {
    const isReg = p === 'reg';
    document.getElementById('page-reg').classList.toggle('hidden', !isReg);
    document.getElementById('page-view').classList.toggle('hidden', isReg);

    const active = "flex-1 py-3 rounded-2xl font-bold bg-blue-600 text-white shadow-lg";
    const inactive = "flex-1 py-3 rounded-2xl font-bold bg-white text-gray-600 border border-gray-200";

    document.getElementById('btn-tab-reg').className = isReg ? active : inactive;
    document.getElementById('btn-tab-view').className = !isReg ? active : inactive;
};

// 手動入力を有効にする
window.enableManualInput = function () {
    const cameraInput = document.getElementById('cameraInput');
    cameraInput.disabled = false;
    cameraInput.parentElement.classList.remove('opacity-50', 'pointer-events-none');
    // ステータスを更新
    document.getElementById('status').innerText = "⌨️ 手動で項目を入力してください";
    // 編集カード（黄色いテーブル）を表示し、中身を空にする
    document.getElementById('editCard').classList.remove('hidden');
    document.getElementById('manualInputOption').classList.add('hidden');

    document.getElementById('td-date').innerText = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    document.getElementById('td-price').innerText = "0";
    document.getElementById('td-store').innerText = "（手動入力）";
    document.getElementById('td-item').innerText = "（手動入力）";

    // datePickerが取得できているか確認（なければここで取得）
    if (!datePicker) datePicker = document.getElementById('date-picker');
    if (!dateDisplay) dateDisplay = document.getElementById('td-date');

    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;
    dateDisplay.innerText = today.replace(/-/g, '/');

    // 画像があれば出し、なければ隠す
    const thumbContainer = document.getElementById('thumbContainer');
    if (lastImageBase64) {
        thumbContainer.classList.remove('hidden');
    } else {
        thumbContainer.classList.add('hidden');
    }

    // 登録ボタンを表示
    document.getElementById('regBtn').classList.remove('hidden');
    document.getElementById('regBtn').innerText = "💾 手動で登録する";
};

window.loadList = async function () {
    const listBody = document.getElementById('listBody');
    listBody.innerHTML = '<p class="text-center text-gray-400 py-10">読み込み中...</p>';
    const pass = localStorage.getItem('my_app_pass');
    try {
        const res = await fetch(`${GAS_URL}?pass=${pass}`);
        const data = await res.json();
        listBody.innerHTML = data.reverse().map(item => `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
                <div>
                    <div class="text-[10px] text-gray-400 font-mono">${item.date}</div>
                    <div class="font-bold text-gray-800 text-sm">${item.itemName}</div>
                    <div class="text-xs text-gray-500">${item.store}</div>
                </div>
                <div class="text-right">
                    <div class="font-black text-blue-600">¥${Number(item.price).toLocaleString()}</div>
                    <div class="flex gap-2 mt-2 justify-end">
                        <a href="${item.fileUrl}" target="_blank" class="text-[10px] bg-blue-50 text-blue-500 px-2 py-1 rounded-md">証憑</a>
                        <button onclick="editItem(${item.rowNum}, '${item.date}', '${item.price}', '${item.store}', '${item.itemName}')" 
                    class="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded-md">編集</button>
                        <button onclick="deleteItem(${item.rowNum})" class="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded-md">削除</button>
                    </div>
                </div>
                <div class="border-t border-gray-50 pt-2 mt-2 text-[9px] text-gray-300 flex justify-between">
                    <span>登録日: ${item.registerDate}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.log(e)
        if (e.message.indexOf("Auth Error") != -1) {
            listBody.innerHTML = '<p class="text-center text-red-400 py-10">❌ パスワードが違います</p>';
        } else {
            listBody.innerHTML = '<p class="text-center text-red-400 py-10">取得失敗。</p>';
        }
    }
};

// --- 削除用関数の追加 ---
window.deleteItem = async function (rowNum) {
    if (!confirm("このデータを削除してもよろしいですか？（スプレッドシートから行が削除されます）")) return;

    const pass = localStorage.getItem('my_app_pass');
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "delete", rowNum: rowNum, pass: pass })
        });
        const json = await res.json();
        if (json.status === "success") {
            alert("削除しました");
            loadList(); // リストを再読み込み
        } else if (json.message.includes("認証エラー")) {
            alert("❌ パスワードが違います");
        }
    } catch (e) {
        alert("削除に失敗しました");
    }
};

// --- 編集用関数 ---
window.editItem = function (rowNum, date, price, store, itemName) {
    // 登録用フォームを編集用に流用する
    showPage('reg');
    document.getElementById('status').innerText = "📝 データを編集して保存してください";

    // ★編集時はサムネイルを隠す
    document.getElementById('thumbContainer').classList.add('hidden');
    document.getElementById('thumbnail').src = "";

    // フォームに現在の値をセット
    document.getElementById('td-date').innerText = date;
    document.getElementById('td-price').innerText = price;
    document.getElementById('td-store').innerText = store;
    document.getElementById('td-item').innerText = itemName;
    document.getElementById('editCard').classList.remove('hidden');

    // 登録ボタンを「更新ボタン」に書き換える
    const regBtn = document.getElementById('regBtn');
    regBtn.innerText = "🆙 データを更新する";
    regBtn.onclick = async () => {
        const pass = localStorage.getItem('my_app_pass');
        const data = {
            action: "update",
            rowNum: rowNum,
            pass: pass,
            date: document.getElementById('td-date').innerText.trim(),
            price: document.getElementById('td-price').innerText.replace(/[^0-9]/g, ''),
            store: document.getElementById('td-store').innerText.trim(),
            itemName: document.getElementById('td-item').innerText.trim()
        };

        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(data) });
        const json = await res.json()
        if (json.status === "success") {
            alert("更新しました");
            location.reload();
        } else if (json.message.includes("認証エラー")) {
            alert("❌ パスワードが違います");
        }
    };
};

document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('my_app_pass');
    if (saved) document.getElementById('appPass').value = saved;

    // --- 初期設定（DOM読み込み時などに追加） ---
    datePicker = document.getElementById('date-picker');
    dateDisplay = document.getElementById('td-date');

    // カレンダーの値が変わったら表示を更新
    datePicker.addEventListener('change', (e) => {
        const val = e.target.value; // YYYY-MM-DD
        if (val) {
            dateDisplay.innerText = val.replace(/-/g, '/'); // YYYY/MM/DD 形式で表示
        }
    });

    // 画像選択・解析イベント
    document.getElementById('cameraInput').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const status = document.getElementById('status');
        const label = e.target.parentElement; // 枠（label）を取得

        // --- 処理開始: ボタンを非活性に ---
        e.target.disabled = true;
        label.classList.add('opacity-50', 'pointer-events-none');
        status.innerText = "🔄 画像を解析中...";
        document.getElementById('manualInputOption').classList.add('hidden'); // ボタンを隠しておく

        try {
            const base64 = await resizeImage(file);
            lastImageBase64 = base64;

            // ★サムネイルを表示し、コンテナの hidden を取る
            const thumb = document.getElementById('thumbnail');
            const thumbContainer = document.getElementById('thumbContainer');
            thumb.src = "data:image/jpeg;base64," + base64;
            thumbContainer.classList.remove('hidden');

            const res = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: "analyze",
                    imageBase64: base64,
                    pass: localStorage.getItem('my_app_pass')
                })
            });

            // 503エラーなどのHTTPエラーをキャッチ
            if (res.status === 503) {
                status.innerText = "❌ AIサーバーが混雑しています";
                document.getElementById('manualInputOption').classList.remove('hidden');
                return;
            }

            const json = await res.json();
            console.log("GASからのレスポンス:", json);

            if (json.status === "success") {
                document.getElementById('td-date').innerText = json.data.date;
                document.getElementById('td-price').innerText = json.data.price;
                document.getElementById('td-store').innerText = json.data.store;
                document.getElementById('td-item').innerText = json.data.itemName;
                document.getElementById('editCard').classList.remove('hidden');
                document.getElementById('regBtn').classList.remove('hidden'); // ボタン表示
                // AIが返してきた "2024/02/27" 形式を "2024-02-27" に変換してセット
                const formattedDate = json.data.date.replace(/\//g, '-');
                datePicker.value = formattedDate;
                dateDisplay.innerText = json.data.date;
                status.innerText = "✨ 解析が完了しました";
            } else if (json.message.includes("認証エラー")) {
                status.innerText = "❌ パスワードが違います";
            } else {
                status.innerText = "❌ 解析エラー: " + json.message;
                document.getElementById('manualInputOption').classList.remove('hidden');
            }
        } catch (err) {
            console.error("通信失敗:", err);
            status.innerText = "❌ 通信に失敗しました";
            document.getElementById('manualInputOption').classList.remove('hidden');
        } finally {
            // --- 処理終了: ボタンを活性に戻す ---
            e.target.disabled = false;
            label.classList.remove('opacity-50', 'pointer-events-none');
            e.target.value = "";
        }
    };

    // 最終登録イベント
    document.getElementById('regBtn').onclick = async () => {
        const btn = document.getElementById('regBtn');
        let date = document.getElementById('td-date').innerText.trim();
        let store = document.getElementById('td-store').innerText.trim();
        let itemName = document.getElementById('td-item').innerText.trim();
        let price = document.getElementById('td-price').innerText.replace(/[^0-9]/g, '');

        // バリデーション
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) return alert("日付形式を YYYY/MM/DD にしてください");
        if (!price) return alert("金額を数字で入力してください");

        // --- 処理開始: ボタンを非活性に ---
        btn.disabled = true;
        btn.innerText = "⌛ 保存中...";
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        btn.disabled = true;
        btn.innerText = "⌛ 保存中...";

        const data = {
            action: "register",
            pass: localStorage.getItem('my_app_pass'),
            date, store, itemName, price,
            imageBaseBase64: lastImageBase64
        };

        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(data) });
            const json = await res.json();
            if (json.status === "success") {
                alert("登録完了しました！続けて別の項目を登録できます。");

                // 入力欄をクリア（画像 lastImageBase64 は保持される）
                document.getElementById('td-price').innerText = "";
                document.getElementById('td-item').innerText = "";
                // 日付や店名は同じはずなので残しておくと便利です

                btn.disabled = false;
                btn.innerText = "✅ 続けて別の商品を登録";
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else if (json.message.includes("認証エラー")) {
                alert(json.message);
            } else {
                alert(json.message);
                btn.disabled = false;
            }
        } catch (e) {
            alert("送信エラー");
            // 失敗時のみボタンを戻す
            btn.disabled = false;
            btn.innerText = "✅ この内容で確定・保存";
            btn.classList.remove('opacity-50', 'cursor-not-allowed');

        }
    };

})
// 画像リサイズ処理
function resizeImage(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = Math.min(1280 / img.width, 1280 / img.height, 1);
                canvas.width = img.width * ratio; canvas.height = img.height * ratio;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}