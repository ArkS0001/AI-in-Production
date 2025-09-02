<img width="1024" height="1024" alt="8592a0a6-42b5-4a35-8ea6-3c99ad577c2a" src="https://github.com/user-attachments/assets/eebd862b-fbd3-4f6e-bcf2-739f75e5b6d6" />

 **how to deploy a frontend app that calls an API without exposing the API key or secrets to the client**. This is super important in production because anything in the frontend bundle is visible to users. Here’s the clean, production-friendly way to do it:

---

### **1. Use a serverless function or backend proxy**

Instead of calling the API directly from the frontend, your frontend calls **your own server or serverless function**, which holds the API key safely.

**Flow:**

```
Frontend (React/Vue) ---> Your Server/Serverless Function ---> External API
```

* The API key is stored **server-side** (env variables), never sent to the client.
* Frontend never sees the key, only your server handles it.

---

### **2. Vercel Example**

Vercel makes this easy using **Serverless Functions**.

1. **Create a file:**
   `/api/groq.js` (or `.ts`)

```js
export default async function handler(req, res) {
  const apiKey = process.env.GROQ_API_KEY; // store key in Vercel env vars
  const body = req.body;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  res.status(200).json(data);
}
```

2. **Store your API key in Vercel Dashboard**

   * Project → Settings → Environment Variables → Add `GROQ_API_KEY`.

3. **Frontend calls `/api/groq`**

```js
const res = await fetch("/api/groq", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
});
const data = await res.json();
```

✅ Key never appears in the client bundle.

---

### **3. Optional: Add extra security**

* Rate-limit requests on your serverless function.
* Validate incoming requests to prevent misuse.
* Only allow your frontend domain to call the endpoint.

---

**TL;DR:** Always **proxy API calls through a server** (serverless function works perfectly on Vercel) and store your secrets in environment variables. Frontend talks only to your server.

---

Perfect! Here’s a clean, **classic flowchart-style diagram** showing how to deploy your app with API integration **without exposing the API key**:

```
+-------------------+
|   Frontend App    |
|  (React/Vue)      |
|  - Sends requests |
|    to /api/groq   |
+--------+----------+
         |
         v
+-------------------+
| Serverless / API  |
| Function (Vercel)|
|  - Reads API key  |
|    from ENV       |
|  - Forwards req   |
|    to external API|
+--------+----------+
         |
         v
+-------------------+
| External API      |
|  - Processes req  |
|  - Returns data   |
+--------+----------+
         |
         v
+-------------------+
| Frontend Receives |
|  Response Data    |
|  (No API Key sent)|
+-------------------+
```

### **Explanation**

1. **Frontend never sees the API key** — it only talks to your serverless function.
2. **Serverless function reads the API key from environment variables** (Vercel, Netlify, etc.).
3. **Serverless function forwards the request to the API**, retrieves the response, and returns it to the frontend.
4. You can also **add rate limiting, authentication, or request validation** in your serverless function for extra security.

---



