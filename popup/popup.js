const form = document.getElementById('dic:form');
const input = document.getElementById('dic:inputString');
const message = document.getElementById('message');
const answer = document.getElementById('chatgpt:answer');
const loading = document.getElementById('chatgpt:loading');

var widget, views = 0, curTrack = 0, totalTracks = 0;
const OPENAI_API_KEY = '';

if (OPENAI_API_KEY.length === 0) {
  alert('Update OpenAI API key!');
}

// The async IIFE is necessary because Chrome <89 does not support top level await.
(async function initPopupWindow() {
  console.log('popup script loaded');
  form.addEventListener('submit', handleFormSubmit);

  await deleteDomainCookies('youglish.com');
  input.focus();
})();

async function handleFormSubmit(event) {
  event.preventDefault();

  setLoading();
  clearMessage();
  clearAnswer();

  let word = input.value;
  console.log('word', word);

  if (!word) {
    setMessage('Enter a word');
    return;
  }

  Promise.all([
    getAnswerFromChatGPT(word),
    searchYouglish(word),
  ])
  .catch(err => {
    setMessage(err.message);
    clearLoading();
  })
}

async function deleteDomainCookies(domain) {
  let cookiesDeleted = 0;
  try {
    const cookies = await chrome.cookies.getAll({ domain });

    if (cookies.length === 0) {
      return 'No cookies found';
    }

    let pending = cookies.map(deleteCookie);
    await Promise.all(pending);

    cookiesDeleted = pending.length;
  } catch (error) {
    return `Unexpected error: ${error.message}`;
  }

  return `Deleted ${cookiesDeleted} cookie(s).`;
}

function deleteCookie(cookie) {
  // Cookie deletion is largely modeled off of how deleting cookies works when using HTTP headers.
  // Specific flags on the cookie object like `secure` or `hostOnly` are not exposed for deletion
  // purposes. Instead, cookies are deleted by URL, name, and storeId. Unlike HTTP headers, though,
  // we don't have to delete cookies by setting Max-Age=0; we have a method for that ;)
  //
  // To remove cookies set with a Secure attribute, we must provide the correct protocol in the
  // details object's `url` property.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#Secure
  const protocol = cookie.secure ? 'https:' : 'http:';

  // Note that the final URL may not be valid. The domain value for a standard cookie is prefixed
  // with a period (invalid) while cookies that are set to `cookie.hostOnly == true` do not have
  // this prefix (valid).
  // https://developer.chrome.com/docs/extensions/reference/cookies/#type-Cookie
  const cookieUrl = `${protocol}//${cookie.domain}${cookie.path}`;

  return chrome.cookies.remove({
    url: cookieUrl,
    name: cookie.name,
    storeId: cookie.storeId
  });
}

async function getAnswerFromChatGPT(word) {
  try {
    const queryString = `영어 단어 '${word}'의 뜻이 뭐야? 그리고 비슷한 영단어도 3개 알려줘`;

    const init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}` 
      },
      body: `{
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "${queryString}"}]
      }`
    }
  
    const request = new Request('https://api.openai.com/v1/chat/completions', init);
    const response = await fetch(request);
    const data = await response.json();
    const answer = data.choices[0].message.content;

    console.log('init', init);
    console.log('response', response);

    clearLoading();
    setAnswer(answer);

  } catch(err) {
    console.error('getAnswerFromChatGPT: ', err.message);
    setMessage(err.message);
    clearAnswer();
    clearLoading();
  }
}


async function searchYouglish(word) {
  try {
    widget = new YG.Widget('youglish:widget', {
      width: 480,
      autoStart: 1,
      components: 94, // 64 + 16 + 8 + 4 + 2
      events: {
        'onFetchDone': onFetchDone,
        'onVideoChange': onVideoChange,
        'onCaptionConsumed': onCaptionConsumed
      }          
    });
    // 4. process the query
    await widget.fetch(word, 'english');

  } catch(err) {
    console.error('searchYouglish: ', err.message);
    setMessage(err.message);
    clearAnswer();
    clearLoading();
  }
}

// 5. The API will call this method when the search is done
function onFetchDone(event){
  if (event.totalResult === 0){
    setMessage('No Youglish result found');
  }
  else totalTracks = event.totalResult; 
}
    
// 6. The API will call this method when switching to a new video. 
function onVideoChange(event){
  curTrack = event.trackNumber;
  views = 0;
}
    
// 7. The API will call this method when a caption is consumed. 
function onCaptionConsumed(event){
  if (++views < 3)
    widget.replay();
  else 
    if (curTrack < totalTracks)  
      widget.next();
} 

function setMessage(str) {
  message.textContent = str;
  message.hidden = false;
}

function clearMessage() {
  message.textContent = '';
  message.hidden = true;
}

function setAnswer(str) {
  answer.textContent = str;
  answer.hidden = false;
}

function clearAnswer() {
  answer.textContent = '';
  answer.hidden = true;
}

function setLoading() {
  loading.hidden = false;
}

function clearLoading() {
  loading.hidden = true;
}
