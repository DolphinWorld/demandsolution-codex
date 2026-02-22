from __future__ import annotations

import html
import re
import time
from typing import Dict, List, Optional

import requests

from .models import RedditPost


class SocialClient:
    def __init__(self, user_agent: str, timeout_s: int = 20, max_retries: int = 4) -> None:
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": user_agent,
                "Accept": "application/json",
            }
        )

    def _request_json(self, url: str, params: Optional[Dict] = None) -> Dict:
        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.session.get(url, params=params, timeout=self.timeout_s)
                if response.status_code in {429, 500, 502, 503, 504}:
                    time.sleep(min(10, 1.5 * attempt))
                    continue
                response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(1.3 * attempt)
                else:
                    raise RuntimeError(f"Social request failed after retries: {url}") from last_error
        raise RuntimeError(f"Unexpected request failure: {url}")

    @staticmethod
    def _strip_html(raw: str) -> str:
        text = re.sub(r"<[^>]+>", " ", raw or "")
        text = html.unescape(text)
        return re.sub(r"\s+", " ", text).strip()

    def fetch_hn_search(self, query: str, limit: int = 60) -> List[RedditPost]:
        out: List[RedditPost] = []
        page = 0
        remaining = max(1, limit)

        while remaining > 0:
            page_limit = min(100, remaining)
            payload = self._request_json(
                "https://hn.algolia.com/api/v1/search_by_date",
                params={
                    "query": query,
                    "tags": "story",
                    "hitsPerPage": page_limit,
                    "page": page,
                },
            )
            hits = payload.get("hits", [])
            if not hits:
                break

            for item in hits:
                post_id = str(item.get("objectID", "")).strip()
                title = str(item.get("title") or item.get("story_title") or "").strip()
                if not post_id or not title:
                    continue
                created_utc = float(item.get("created_at_i") or 0)
                points = int(item.get("points") or 0)
                num_comments = int(item.get("num_comments") or 0)
                permalink = f"https://news.ycombinator.com/item?id={post_id}"
                url = str(item.get("url") or permalink)
                body = str(item.get("story_text") or item.get("comment_text") or "").strip()

                out.append(
                    RedditPost(
                        id=post_id,
                        subreddit="hackernews",
                        title=title,
                        selftext=body,
                        author=str(item.get("author") or ""),
                        created_utc=created_utc,
                        score=points,
                        num_comments=num_comments,
                        upvote_ratio=0.0,
                        permalink=permalink,
                        url=url,
                        sort_source=f"hn:{query}",
                    )
                )

            page += 1
            remaining -= len(hits)
            if len(hits) < page_limit:
                break
            time.sleep(0.3)

        return out

    def fetch_stackexchange_search(
        self,
        query: str,
        site: str = "stackoverflow",
        limit: int = 60,
        from_date_utc: Optional[int] = None,
    ) -> List[RedditPost]:
        out: List[RedditPost] = []
        page = 1
        remaining = max(1, limit)

        while remaining > 0:
            page_limit = min(100, remaining)
            params: Dict = {
                "order": "desc",
                "sort": "creation",
                "site": site,
                "q": query,
                "pagesize": page_limit,
                "page": page,
                "filter": "withbody",
            }
            if from_date_utc is not None:
                params["fromdate"] = int(from_date_utc)

            payload = self._request_json("https://api.stackexchange.com/2.3/search/advanced", params=params)
            items = payload.get("items", [])
            if not items:
                break

            for item in items:
                question_id = str(item.get("question_id", "")).strip()
                title = str(item.get("title") or "").strip()
                if not question_id or not title:
                    continue

                body = self._strip_html(str(item.get("body") or ""))
                created_utc = float(item.get("creation_date") or 0)
                permalink = str(item.get("link") or "")
                if not permalink:
                    permalink = f"https://stackoverflow.com/questions/{question_id}"
                score = int(item.get("score") or 0)
                answers = int(item.get("answer_count") or 0)

                out.append(
                    RedditPost(
                        id=question_id,
                        subreddit=f"stackexchange:{site}",
                        title=title,
                        selftext=body,
                        author=str(item.get("owner", {}).get("display_name") or ""),
                        created_utc=created_utc,
                        score=score,
                        num_comments=answers,
                        upvote_ratio=0.0,
                        permalink=permalink,
                        url=permalink,
                        sort_source=f"se:{site}:{query}",
                    )
                )

            remaining -= len(items)
            if not payload.get("has_more"):
                break
            page += 1
            time.sleep(0.35)

        return out
