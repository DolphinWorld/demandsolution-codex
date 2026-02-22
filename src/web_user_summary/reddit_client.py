from __future__ import annotations

import os
import time
from typing import Dict, List, Optional

import requests

from .models import RedditPost


class RedditClient:
    def __init__(
        self,
        user_agent: str,
        timeout_s: int = 20,
        max_retries: int = 4,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> None:
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self.user_agent = user_agent
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": user_agent,
                "Accept": "application/json",
            }
        )
        self.client_id = (client_id or os.getenv("REDDIT_CLIENT_ID", "")).strip()
        self.client_secret = (client_secret or os.getenv("REDDIT_CLIENT_SECRET", "")).strip()
        self.use_oauth = bool(self.client_id and self.client_secret)
        self.oauth_access_token: Optional[str] = None
        self.oauth_expires_at = 0.0

    def _fetch_oauth_token(self) -> None:
        if not self.use_oauth:
            return

        response = self.session.post(
            "https://www.reddit.com/api/v1/access_token",
            auth=(self.client_id, self.client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": self.user_agent},
            timeout=self.timeout_s,
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 3600))
        if not token:
            raise RuntimeError("Reddit OAuth token response did not include access_token")

        self.oauth_access_token = str(token)
        self.oauth_expires_at = time.time() + max(60, expires_in - 60)

    def _ensure_oauth_token(self) -> None:
        if not self.use_oauth:
            return
        if self.oauth_access_token and time.time() < self.oauth_expires_at:
            return
        self._fetch_oauth_token()

    def _request_json(self, url: str, params: Dict) -> Dict:
        last_error: Optional[Exception] = None
        using_oauth = self.use_oauth
        oauth_url = url.replace("https://www.reddit.com", "https://oauth.reddit.com", 1) if using_oauth else url

        for attempt in range(1, self.max_retries + 1):
            try:
                headers: Dict[str, str] = {}
                request_url = url
                if using_oauth:
                    self._ensure_oauth_token()
                    request_url = oauth_url
                    headers["Authorization"] = f"bearer {self.oauth_access_token}"

                response = self.session.get(request_url, params=params, headers=headers or None, timeout=self.timeout_s)

                if response.status_code in {429, 500, 502, 503, 504}:
                    sleep_s = min(12, 2 * attempt)
                    time.sleep(sleep_s)
                    continue

                if response.status_code in {401, 403} and using_oauth:
                    # Token might be expired or revoked mid-run; refresh and retry.
                    self.oauth_access_token = None
                    self.oauth_expires_at = 0.0
                    if attempt < self.max_retries:
                        time.sleep(1.2 * attempt)
                        continue

                if response.status_code == 403 and not using_oauth:
                    raise RuntimeError(
                        "Reddit returned 403 (blocked). Configure REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET "
                        "for OAuth-based access from GitHub Actions."
                    )

                response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(1.3 * attempt)
                else:
                    auth_hint = (
                        " OAuth mode was enabled." if using_oauth else " OAuth mode was not enabled."
                    )
                    raise RuntimeError(f"Reddit request failed after retries: {url}.{auth_hint}") from last_error
        raise RuntimeError(f"Unexpected request failure: {url}")

    def fetch_subreddit_posts(self, subreddit: str, sort: str = "new", limit: int = 100) -> List[RedditPost]:
        if sort not in {"new", "hot", "top"}:
            raise ValueError("sort must be one of: new, hot, top")

        out: List[RedditPost] = []
        after: Optional[str] = None
        remaining = max(1, limit)

        while remaining > 0:
            page_limit = min(100, remaining)
            params = {"limit": page_limit, "raw_json": 1}
            if after:
                params["after"] = after

            url = f"https://www.reddit.com/r/{subreddit}/{sort}.json"
            payload = self._request_json(url, params=params)
            data = payload.get("data", {})
            children = data.get("children", [])

            for child in children:
                item = child.get("data", {})
                post = RedditPost(
                    id=str(item.get("id", "")),
                    subreddit=str(item.get("subreddit", subreddit)),
                    title=str(item.get("title", "")).strip(),
                    selftext=str(item.get("selftext", "")).strip(),
                    author=str(item.get("author", "")),
                    created_utc=float(item.get("created_utc", 0.0)),
                    score=int(item.get("score", 0)),
                    num_comments=int(item.get("num_comments", 0)),
                    upvote_ratio=float(item.get("upvote_ratio", 0.0) or 0.0),
                    permalink=f"https://www.reddit.com{item.get('permalink', '')}",
                    url=str(item.get("url", "")),
                    sort_source=sort,
                )
                if post.id and post.title:
                    out.append(post)

            after = data.get("after")
            if not after or not children:
                break
            remaining -= len(children)
            time.sleep(0.6)

        return out

    def fetch_subreddit_search(self, subreddit: str, query: str, sort: str = "new", limit: int = 50) -> List[RedditPost]:
        out: List[RedditPost] = []
        after: Optional[str] = None
        remaining = max(1, limit)

        while remaining > 0:
            page_limit = min(100, remaining)
            params = {
                "q": query,
                "restrict_sr": "1",
                "sort": sort,
                "limit": page_limit,
                "raw_json": 1,
            }
            if after:
                params["after"] = after

            url = f"https://www.reddit.com/r/{subreddit}/search.json"
            payload = self._request_json(url, params=params)
            data = payload.get("data", {})
            children = data.get("children", [])

            for child in children:
                item = child.get("data", {})
                post = RedditPost(
                    id=str(item.get("id", "")),
                    subreddit=str(item.get("subreddit", subreddit)),
                    title=str(item.get("title", "")).strip(),
                    selftext=str(item.get("selftext", "")).strip(),
                    author=str(item.get("author", "")),
                    created_utc=float(item.get("created_utc", 0.0)),
                    score=int(item.get("score", 0)),
                    num_comments=int(item.get("num_comments", 0)),
                    upvote_ratio=float(item.get("upvote_ratio", 0.0) or 0.0),
                    permalink=f"https://www.reddit.com{item.get('permalink', '')}",
                    url=str(item.get("url", "")),
                    sort_source=f"search:{query}",
                )
                if post.id and post.title:
                    out.append(post)

            after = data.get("after")
            if not after or not children:
                break
            remaining -= len(children)
            time.sleep(0.6)

        return out
