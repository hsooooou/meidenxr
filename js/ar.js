// サポート画面開く
$('.question').click(function(){
  $('.question').toggleClass('is-active');
  $('.vr-info').toggleClass('is-active');
})

$('.burger').click(function(){
  $('.under-list').toggleClass('is-active');
})

// 合言葉モーダル
function checkKeyword() {
  const correctKeyword = "とまと";  // 正解の合言葉をここに設定
  const input = document.getElementById("keywordInput").value.trim();
  const result = document.getElementById("keywordResult");

  if (input === correctKeyword) {
    window.location.href = "./ar-finish.html";
  } else {
    result.innerHTML = "合言葉が違うよ！<br>もう一度試してね。";
    result.style.display = "block";

    setTimeout(() => {
      result.style.display = "none";
    }, 10000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('#button-img');

  button.addEventListener('click', () => {
    window.location.href = 'https://hsooooou.github.io/meidenxr/schoolmap/vr-n02-idr.html';
  });
});