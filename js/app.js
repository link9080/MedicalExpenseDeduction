/**
 * 医療費控除DX - Core Logic
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzGnL-VjvBcYYK3MBUdFzTuq2NkqJCCbAP2gu5PFXZvhjLH3shj1QJNoaavhSRUlNe1hA/exec";
let lastImageBase64 = "";

// 初期化：保存済みパスワードの読み込み
window.onload = () => {
    const saved = localStorage.getItem('my_app_pass');
    if (saved) document.getElementById('appPass').value = saved;
};

// パスワード保存
function savePass() {
    localStorage.setItem('my_app_pass', document.getElementById('appPass').value);
    alert("パスワードを保存しました");
}

// ページ（タブ）切り替え
function showPage(p) {
    const isReg = p === 'reg';
    document.getElementById('page-reg').classList.toggle('hidden', !isReg);
    document.getElementById('page-view').classList.toggle('hidden', isReg);

    const activeClass = "flex-1 py-3 rounded-2xl font-bold bg-blue-600 text-white shadow-lg";
    const inactiveClass = "flex-1 py-3 rounded-2xl font-bold bg-white text-slate-600 border border-slate-200";

    document.getElementById('btn-tab-reg').className = isReg ? activeClass : inactiveClass;
    document.getElementById('btn-tab-view').className = !isReg ? activeClass : inactiveClass;
}

// 画像選択・解析イベント
document.getElementById('cameraInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const status = document.getElementById('status');
    status.innerText = "🔄 画像を解析中...";

    try {
        const base64 = await resizeImage(file);
        lastImageBase64 = base64;

        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "analyze",
                imageBase64: base64,
                pass: localStorage.getItem('my_app_pass')
            })
        });
        const json = await res.json();

        if (json.status === "success") {
            document.getElementById('td-date').innerText = json.data.date;
            document.getElementById('td-price').innerText = json.data.price;
            document.getElementById('td-store').innerText = json.data.store;
            document.getElementById('td-item').innerText = json.data.itemName;
            document.getElementById('editCard').classList.remove('hidden');
            status.innerText = "✨ 解析が完了しました";
        } else {
            alert(json.message);
            status.innerText = "❌ エラーが発生しました";
        }
    } catch (err) {
        alert("通信エラーが発生しました。");
        console.error(err);
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
            alert("登録完了しました！");
            location.reload();
        } else {
            alert(json.message);
            btn.disabled = false;
        }
    } catch (e) {
        alert("送信エラー");
        btn.disabled = false;
    }
};

// 履歴一覧の読み込み
async function loadList() {
    const listBody = document.getElementById('listBody');
    listBody.innerHTML = '<p class="text-center text-slate-400 py-10">読み込み中...</p>';

    const pass = localStorage.getItem('my_app_pass');
    try {
        const res = await fetch(`${GAS_URL}?pass=${pass}`);
        const data = await res.json();

        listBody.innerHTML = data.reverse().map(row => `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center animate-in slide-in-from-bottom-2 duration-300">
                <div>
                    <div class="text-[10px] text-slate-400 font-mono">${row.date}</div>
                    <div class="font-bold text-slate-800 text-sm">${row.itemName}</div>
                    <div class="text-xs text-slate-500">${row.store}</div>
                </div>
                <div class="text-right">
                    <div class="font-black text-blue-600">¥${Number(row.price).toLocaleString()}</div>
                    <a href="${row.fileUrl}" target="_blank" class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md mt-1 inline-block">証憑を表示</a>
                </div>
            </div>
        `).join('');
    } catch (e) {
        listBody.innerHTML = '<p class="text-center text-red-400 py-10">データの取得に失敗しました</p>';
    }
}

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