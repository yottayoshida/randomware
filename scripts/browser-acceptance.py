#!/usr/bin/env python3
"""Render a local accepted creation in Chromium and assert the owner chrome is live."""

import json
import os
import subprocess
import sys
import time
import urllib.request
import ssl
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("RANDOMWARE_BROWSER_PORT", "8799"))
BASE = os.environ.get("RANDOMWARE_BROWSER_BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
CHROME = os.environ.get("RANDOMWARE_BROWSER_EXECUTABLE", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
SSL_CONTEXT = ssl._create_unverified_context() if os.environ.get("RANDOMWARE_BROWSER_BASE") else None


def call(path, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"content-type": "application/json", "user-agent": "Mozilla/5.0 RandomwareBrowserAcceptance"} if body else {"user-agent": "Mozilla/5.0 RandomwareBrowserAcceptance"},
        method="POST" if body else "GET",
    )
    with urllib.request.urlopen(request, timeout=10, context=SSL_CONTEXT) as response:
        return response.status, json.loads(response.read())


def make_concept(run):
    selected = run["selectedApis"]
    ids = [entry["id"] for entry in selected]
    return {
        "requestId": "browser-concept",
        "appName": "Browser Chrome Check",
        "premise": "A browser-rendered assertion turns selected public signals into a visible owner chrome specimen.",
        "playerAction": "Press the specimen button to reveal the bounded browser check.",
        "noveltyDelta": "The browser check keeps the owner chrome visible around the sandbox.",
        "apiIds": ids,
        "apiRoles": [
            {
                "apiId": entry["id"],
                "essentialRole": f"{entry['name']} supplies the browser check signal.",
                "operations": [operation["id"] for operation in entry["operations"]],
            }
            for entry in selected
        ],
        "causalChain": [
            {"order": index + 1, "apiId": entry["id"], "action": f"turn {entry['name']} into the next browser rule"}
            for index, entry in enumerate(selected)
        ],
        "dependency": {"fromApiId": ids[0], "to": "rules", "toApiId": ids[1], "explanation": "The first signal determines the next browser rule."},
        "interaction": {"controls": ["reveal"], "outcome": "The browser specimen reveals a bounded result."},
        "visualDirection": {"style": "owner chrome theatre", "palette": "ink and cyan", "typography": "editorial serif", "motion": "the frame opens cleanly"},
        "bannedShapeAssessment": {"plainDashboard": False, "plainSearch": False, "plainQuiz": False, "randomFactDisplay": False, "thinClone": False, "plausibleStartupPitch": False, "explanation": "This is a browser containment assertion, not a dashboard."},
    }


def make_artifact(run):
    calls = []
    for entry in run["selectedApis"]:
        operation = entry["operations"][0]
        calls.append(f'window.randomware.call("{entry["id"]}","{operation["id"]}",{{}})')
    html = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser check</title></head><body><section data-randomware="loading" hidden>loading</section><h1>Browser chrome check</h1><button type="button" onclick="reveal()">Reveal</button><section data-randomware="interactive"><p>owner chrome must remain visible</p></section><section data-randomware="error" hidden>error</section><footer data-randomware="attribution">attribution</footer><script>window.randomware.ready();async function reveal(){{await Promise.all([{','.join(calls)}]);}}</script><!-- {'browser-check ' * 1800} --></body></html>'''
    return html


def main():
    env = os.environ.copy()
    env.update({"PORT": str(PORT), "RANDOMWARE_FIXTURES": "1"})
    server = None
    if not os.environ.get("RANDOMWARE_BROWSER_BASE"):
        server = subprocess.Popen(["node", "src/server.js"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if server:
            for _ in range(50):
                try:
                    status, body = call("/healthz")
                    if status == 200 and body.get("ok"):
                        break
                except Exception:
                    time.sleep(0.1)
            else:
                raise AssertionError("local server did not become ready")

        _, run = call("/api/spin", {"seed": "browser-acceptance", "requestId": "browser-spin"})
        concept = make_concept(run)
        concept["runId"] = run["runId"]
        status, _ = call(f"/api/runs/{run['runId']}/concept", concept)
        assert status == 200, f"concept_status:{status}"
        status, artifact = call(f"/api/runs/{run['runId']}/artifact", {"requestId": "browser-artifact", "html": make_artifact(run)})
        assert status == 200, f"artifact_status:{status}"

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=CHROME if Path(CHROME).exists() else None)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            response = page.goto(f"{BASE}/c/{artifact['creationId']}", wait_until="networkidle")
            csp = response.headers.get("content-security-policy", "")
            border_width = page.locator(".rw-chrome").evaluate("element => getComputedStyle(element).borderTopWidth")
            frame_height = page.locator("iframe.rw-frame").bounding_box()["height"]
            assert "style-src 'self'" in csp and "unsafe-inline" not in csp, f"owner_csp_not_strict:{csp}"
            assert page.locator("style").count() == 0, "inline_style_present"
            assert page.locator("script").count() == 0, "inline_script_present"
            assert border_width == "2px", f"unstyled_chrome:border={border_width}"
            assert frame_height >= 390, f"frame_too_short:{frame_height}"

            widget_page = browser.new_page(viewport={"width": 390, "height": 844})
            spin_run = {"runId": "widget-run", "phase": "spinned", "selectedApis": [{"id": "frankfurter", "name": "Frankfurter", "operations": []}]}
            concept_run = {**spin_run, "phase": "concept_accepted"}
            complete_run = {**concept_run, "phase": "completed", "creationId": "widget-creation"}
            envelope = lambda value: {"content": [{"type": "text", "text": "fixture result"}], "structuredContent": value}
            mount_output = json.dumps({"ok": True, "registry": 18})
            init_script = (
                "window.openai = {toolOutput: " + mount_output + ", widgetState: null, "
                "setWidgetState: state => window.__widgetState = state, "
                "callTool: async name => {"
                "if (name !== 'spin_apis') throw new Error('unexpected tool');"
                "setTimeout(() => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: " + mount_output + "}}})), 10);"
                "return " + json.dumps(envelope(spin_run)) + ";"
                "}, openExternal: () => {}};"
            )
            widget_page.add_init_script(init_script)
            widget_page.goto(BASE, wait_until="domcontentloaded")
            _, widget_body = call("/mcp", {"jsonrpc": "2.0", "id": "widget-resource", "method": "resources/read", "params": {"uri": "ui://widget/randomware.html"}})
            widget_html = widget_body["result"]["contents"][0]["text"]
            widget_page.set_content(widget_html, wait_until="domcontentloaded")
            widget_page.locator("#spin").click()
            widget_page.wait_for_timeout(900)
            assert widget_page.locator("#status").inner_text() != "The slot is ready.", "widget_reset_to_idle_after_callTool"
            assert widget_page.locator("#apis li").count() == 1, "widget_reels_not_rendered"
            assert widget_page.locator("#build").is_visible(), "widget_build_action_not_rendered"
            widget_page.locator("#build").click()
            assert widget_page.locator("#fallback").is_visible(), "widget_follow_up_fallback_missing"
            fallback_prompt = widget_page.locator("#build-prompt").input_value()
            assert "Use Randomware run widget-run:" in fallback_prompt, "widget_fallback_run_id_missing"
            assert "submit the complete artifact via submit_artifact" in fallback_prompt, "widget_fallback_prompt_incomplete"
            assert widget_page.evaluate("window.__widgetState?.paused") is True, "widget_concept_timer_not_paused"
            widget_page.evaluate("window.openai.sendFollowUpMessage = async arg => { window.__followUpPrompt = arg && arg.prompt; return {ok: false, error: 'host refused'}; }")
            widget_page.locator("#build").click()
            assert widget_page.locator("#fallback").is_visible(), "widget_unsuccessful_follow_up_not surfaced"
            widget_page.evaluate("window.openai.sendFollowUpMessage = async arg => { window.__followUpPrompt = arg && arg.prompt; return {ok: true}; }")
            widget_page.locator("#build").click()
            assert "Waiting for the model" in widget_page.locator("#status").inner_text(), "widget_follow_up_success_not_rendered"
            assert not widget_page.locator("#fallback").is_visible(), "widget_fallback_not_cleared_after_success"
            assert "Use Randomware run widget-run:" in widget_page.evaluate("window.__followUpPrompt"), "widget_follow_up_run_id_missing"
            widget_page.evaluate("envelope => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: envelope}}}))", envelope(concept_run))
            assert "Concept accepted" in widget_page.locator("#status").inner_text(), "widget_artifact_transition_missing"
            widget_page.evaluate("envelope => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: envelope}}}))", envelope(complete_run))
            assert widget_page.locator("#creation").is_visible(), "widget_creation_section_missing"
            assert not widget_page.locator("#creation-frame").get_attribute("hidden"), "widget_creation_frame_not_embedded"
            assert "/c/widget-creation" in widget_page.locator("#creation-link").get_attribute("href"), "widget_creation_link_missing"
            print(json.dumps({"ok": True, "borderTopWidth": border_width, "frameHeight": frame_height, "widgetEnvelope": True, "widgetTransitions": True}))
            browser.close()
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"browser acceptance failed: {error}", file=sys.stderr)
        sys.exit(1)
