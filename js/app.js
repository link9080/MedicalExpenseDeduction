/**
 * 医療費控除DX - Core Logic
 */
// --- HTMLから直接呼ばれる関数を window に登録 ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbzACJuhz5o57jqnGukE2wJ-dgwiQ8HmyniwodoAICskSbEV6cYESU6nlC6QntjZ1tD-9g/exec";
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
    document.getElementById('td-store').innerText = "（手動入力）";

    // 💡 商品コンテナに空の入力を1行だけ作る
    const itemsContainer = document.getElementById('itemsContainer');
    itemsContainer.innerHTML = `
        <div class="item-row p-4 flex gap-2 items-center bg-white">
            <input type="checkbox" checked class="item-checkbox w-4 h-4 text-blue-600 rounded">
            <div class="flex-1 edit-item-name p-1 font-medium text-slate-700 border-b border-slate-200 text-sm" contenteditable="true">（手動入力の商品名）</div>
            <div class="w-24 edit-item-price p-1 font-bold text-right text-slate-900 border-b border-slate-200 text-sm" contenteditable="true" inputmode="numeric">0</div>
        </div>
    `;

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

    // 編集モードでは「商品を追加する」ボタンを隠す
    document.getElementById('addItemBtnContainer').classList.add('hidden');

    // ★編集時はサムネイルを隠す
    document.getElementById('thumbContainer').classList.add('hidden');
    document.getElementById('thumbnail').src = "";

    // フォームに現在の値をセット
    document.getElementById('td-date').innerText = date;
    document.getElementById('td-store').innerText = store;

    // 💡 複数商品用のコンテナに、編集対象の「1件」をセットする
    const itemsContainer = document.getElementById('itemsContainer');
    itemsContainer.innerHTML = `
        <div class="item-row p-4 flex gap-2 items-center bg-amber-50/50">
            <input type="checkbox" checked class="item-checkbox hidden">
            <div class="flex-1 edit-item-name p-1 font-medium text-slate-700 border-b border-amber-300 focus:border-blue-500 focus:bg-white text-sm" contenteditable="true">${itemName}</div>
            <div class="w-24 edit-item-price p-1 font-bold text-right text-slate-900 border-b border-amber-300 focus:border-blue-500 focus:bg-white text-sm" contenteditable="true" inputmode="numeric">${price}</div>
        </div>
    `;

    document.getElementById('editCard').classList.remove('hidden');

    // 登録ボタンを「更新ボタン」に書き換える
    const regBtn = document.getElementById('regBtn');
    regBtn.classList.remove('opacity-50', 'cursor-not-allowed'); // 念のためスタイルリセット
    regBtn.disabled = false;
    regBtn.innerText = "🆙 データを更新する";

    regBtn.onclick = async () => {
        // スピナー代わりのUI変更
        regBtn.disabled = true;
        regBtn.innerText = "⌛ 更新中...";
        regBtn.classList.add('opacity-50', 'cursor-not-allowed');

        const pass = localStorage.getItem('my_app_pass');

        // 💡 変更された値を入力をターゲットに指定して取得
        const updatedItemName = document.querySelector('.edit-item-name').innerText.trim();
        const updatedPrice = document.querySelector('.edit-item-price').innerText.replace(/[^0-9]/g, '');

        const data = {
            action: "update",
            rowNum: rowNum,
            pass: pass,
            date: document.getElementById('td-date').innerText.trim(),
            store: document.getElementById('td-store').innerText.trim(),
            itemName: updatedItemName, // 💡 新UIの場所から取得
            price: updatedPrice        // 💡 新UIの場所から取得
        };

        try {
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(data) });
            const json = await res.json();

            if (json.status === "success") {
                alert("更新しました");
                location.reload();
            } else if (json.message.includes("認証エラー")) {
                alert("❌ パスワードが違います");
                regBtn.disabled = false;
                regBtn.innerText = "🆙 データを更新する";
                regBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                alert("更新エラー: " + json.message);
                regBtn.disabled = false;
                regBtn.innerText = "🆙 データを更新する";
                regBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        } catch (e) {
            alert("通信エラーが発生しました");
            regBtn.disabled = false;
            regBtn.innerText = "🆙 データを更新する";
            regBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    };
};

// 💡 手動で空の商品行を追加する関数
window.addBlankItemRow = function () {
    const itemsContainer = document.getElementById('itemsContainer');

    // もし「対象商品が見つかりませんでした」のメッセージが表示されていたらクリアする
    const noItemMsg = itemsContainer.querySelector('.no-item-message');
    if (noItemMsg) {
        itemsContainer.innerHTML = "";
    }

    const itemHtml = `
        <div class="item-row p-4 flex gap-2 items-center bg-white hover:bg-slate-50 transition-colors animate-in fade-in duration-200">
            <input type="checkbox" checked class="item-checkbox w-4 h-4 text-blue-600 rounded focus:ring-blue-500">
            <div class="flex-1 edit-item-name p-1 font-medium text-slate-700 border-b border-slate-200 focus:border-blue-400 focus:bg-slate-50 text-sm" contenteditable="true">（新しい商品名）</div>
            <div class="w-24 edit-item-price p-1 font-bold text-right text-slate-900 border-b border-slate-200 focus:border-blue-400 focus:bg-slate-50 text-sm" contenteditable="true" inputmode="numeric">0</div>
        </div>
    `;
    itemsContainer.insertAdjacentHTML('beforeend', itemHtml);
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

        //画像ファイル（image/）以外を弾くバリデーション
        if (!file.type.startsWith('image/')) {
            alert('画像ファイル（JPEG、PNGなど）を選択してください。PDFやその他のファイルは解析できません。');
            e.target.value = ""; // 選択された不適切なファイルをクリア
            return; // 処理をここで中断
        }

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
                // 基本情報のセット
                document.getElementById('td-date').innerText = json.data.date;
                document.getElementById('td-store').innerText = json.data.store;

                // 日付ピッカーの同期
                const formattedDate = json.data.date.replace(/\//g, '-');
                datePicker.value = formattedDate;
                dateDisplay.innerText = json.data.date;

                // 💡 複数商品の動的レンダリング
                const itemsContainer = document.getElementById('itemsContainer');
                itemsContainer.innerHTML = ""; // 初期化

                if (json.data.items && json.data.items.length > 0) {
                    json.data.items.forEach((item, index) => {
                        const itemHtml = `
                            <div class="item-row p-4 flex gap-2 items-center bg-white hover:bg-slate-50 transition-colors">
                                <input type="checkbox" checked class="item-checkbox w-4 h-4 text-blue-600 rounded focus:ring-blue-500">
                                <div class="flex-1 edit-item-name p-1 font-medium text-slate-700 border-b border-transparent focus:border-blue-400 focus:bg-slate-50 text-sm" contenteditable="true">${item.name}</div>
                                <div class="w-24 edit-item-price p-1 font-bold text-right text-slate-900 border-b border-transparent focus:border-blue-400 focus:bg-slate-50 text-sm" contenteditable="true" inputmode="numeric">${item.price}</div>
                            </div>
                        `;
                        itemsContainer.insertAdjacentHTML('beforeend', itemHtml);
                    });
                } else {
                    // 💡 あとでJavaScriptから消去しやすいように、class="no-item-message" を追加
                    itemsContainer.innerHTML = `<p class="no-item-message text-center text-sm text-amber-600 py-4">対象商品が見つかりませんでした。</p>`;
                }

                document.getElementById('editCard').classList.remove('hidden');
                document.getElementById('regBtn').classList.remove('hidden');
                status.innerText = "✨ 解析が完了しました";

            } else if (json.status === "invalid") {
                // 💡 明らかにレシートではない画像だった場合の処理
                status.innerText = `🚫 解析不可: ${json.message}`;

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

        // バリデーション
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) return alert("日付形式を YYYY/MM/DD にしてください");

        // 💡 画面上のすべての商品行を取得
        const itemRows = document.querySelectorAll('.item-row');
        let checkedRows = [];

        itemRows.forEach(row => {
            const isChecked = row.querySelector('.item-checkbox').checked;
            if (isChecked) {
                checkedRows.push({
                    name: row.querySelector('.edit-item-name').innerText.trim(),
                    price: row.querySelector('.edit-item-price').innerText.replace(/[^0-9]/g, '')
                });
            }
        });

        if (checkedRows.length === 0) return alert("登録する商品にチェックを入れてください");

        // --- 処理開始: ボタンを非活性に ---
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        // 💡 チェックされた商品の数だけ、順番にGASへ保存リクエストを送る（同期ループ）
        try {
            for (let i = 0; i < checkedRows.length; i++) {
                btn.innerText = `⌛ 保存中... (${i + 1}/${checkedRows.length}件目)`;

                const data = {
                    action: "register",
                    pass: localStorage.getItem('my_app_pass'),
                    date,
                    store,
                    itemName: checkedRows[i].name, // 1件ずつ流し込む
                    price: checkedRows[i].price,     // 1件ずつ流し込む
                    imageBaseBase64: lastImageBase64
                };

                const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(data) });
                const json = await res.json();

                if (json.status !== "success") {
                    throw new Error(json.message || "保存中にエラーが発生しました");
                }
            }

            // 💡 すべてのループが成功した場合
            alert(`${checkedRows.length}件の医療費データを登録完了しました！`);

            // 入力欄のクリア
            document.getElementById('itemsContainer').innerHTML = "";
            btn.disabled = false;
            btn.innerText = "✅ 登録完了（続けて別のレシートをスキャン）";
            btn.classList.remove('opacity-50', 'cursor-not-allowed');

            // カードを隠してステータスを戻す
            document.getElementById('editCard').classList.add('hidden');
            document.getElementById('status').innerText = "画像をアップロードしてください";

        } catch (e) {
            alert("送信エラー: " + e.message);
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