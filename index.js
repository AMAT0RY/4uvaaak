const tgWebApp = window.Telegram.WebApp;
const initData = tgWebApp.initData;
 
fetch('https://api.vrkids.ru:443/user/login', {
  method: 'POST',
  headers: {
    'Credentials': 'include',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    initData
  })
})

.then(response => {
  response.json().then(data => {
    console.log(data);
    document.querySelector("#username").innerHTML = data.username
    if (data.tgData){
        document.querySelector("#Isauth").innerHTML = "You Auth"
    }
  });
})
.catch(error => console.error('Error:', error));

