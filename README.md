# AT機 特日データ管理サイト

HTML、CSS、JavaScriptだけで動く静的サイトです。

## GitHub Pagesで公開する方法

1. このフォルダ内の `index.html`、`style.css`、`app.js` をGitHubリポジトリへ配置します。
2. GitHubの `Settings` → `Pages` で、公開元のブランチとフォルダを選択します。
3. 公開URLへアクセスするとサイトが表示されます。

## データ保存

登録データはブラウザの `localStorage` に保存されます。
別端末へ移す場合やバックアップする場合は、画面右上のCSV出力とCSV取込を使ってください。

## OCRと差枚推定

OCRはTesseract.jsをCDNから読み込みます。
グラフの差枚推定は画像の最終地点を読む簡易推定のため、登録前の確認画面で必ず台番号と差枚を確認・修正してください。
