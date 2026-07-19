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
REQUIRE_AUDIO = os.environ.get("RANDOMWARE_BROWSER_REQUIRE_AUDIO", "1") != "0"


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


def make_concept(run, request_id="browser-concept"):
    selected = run["selectedApis"]
    ids = [entry["id"] for entry in selected]
    return {
        "requestId": request_id,
        "styleId": run["styleId"],
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
    contracts = []
    for entry in run["selectedApis"]:
        operation = entry["operations"][0]
        calls.append(f'window.randomware.call("{entry["id"]}","{operation["id"]}",{{}})')
        contracts.append({"apiId": entry["id"], "path": operation["semanticFieldPaths"][0]})
    html = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser check</title></head><body><section data-randomware="loading" hidden>loading</section><h1>Browser chrome check</h1><button id="reveal" type="button">Reveal</button><section data-randomware="interactive"><p>owner chrome must remain visible</p><pre id="semantic-values">not loaded</pre></section><section data-randomware="error" hidden>error</section><footer data-randomware="attribution">attribution</footer><script>const contracts={json.dumps(contracts)};const read=(value,path)=>path.replace(/\\[(\\d+)\\]/g,'.$1').split('.').filter(Boolean).reduce((current,key)=>current==null?undefined:current[key],value);document.querySelector('#reveal').addEventListener('click',async()=>{{const settled=await Promise.allSettled([{','.join(calls)}]);const values=settled.map((item,index)=>{{if(item.status==='rejected')return contracts[index].apiId+': Source unavailable: '+String(item.reason?.message||'broker_failure');const result=item.value;if(!result||result.ok!==true||!Object.prototype.hasOwnProperty.call(result,'data'))return contracts[index].apiId+': Source unavailable: broker_envelope_invalid';const value=read(result.data,contracts[index].path);if(value===undefined||value===null||value===''||Number.isNaN(value))return contracts[index].apiId+': Source unavailable: semantic_value_missing';return contracts[index].apiId+': '+String(value)}});const output=document.querySelector('#semantic-values');output.textContent=values.join('\\n');output.dataset.semantic=values.some((value)=>!value.includes('Source unavailable:'))?'complete':'degraded'}});window.randomware.ready();</script><!-- {'browser-check ' * 1800} --></body></html>'''
    return html


def make_audio_artifact(run):
    calls = []
    sources = []
    for entry in run["selectedApis"]:
        operation = entry["operations"][0]
        calls.append(f'window.randomware.call("{entry["id"]}","{operation["id"]}",{{}})')
        sources.append(entry["id"])
    script = f'''const sources={json.dumps(sources)};const status=document.querySelector('#audio-status');const audio=document.querySelector('#audio');document.querySelector('#play-audio').addEventListener('click',async()=>{{const settled=await Promise.allSettled([{','.join(calls)}]);const index=sources.indexOf('radio-browser');const item=settled[index];if(!item||item.status!=='fulfilled'||!item.value.data?.mediaUrl){{status.textContent='Source unavailable: radio-browser';return}}audio.src=item.value.data.mediaUrl;try{{await audio.play();status.textContent='Signed audio playing'}}catch(error){{status.textContent='Source unavailable: '+String(error.message||'playback_failed')}}}});window.randomware.ready();'''
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signed audio check</title><style>body{{margin:0;padding:24px;background:#15122b;color:#fff;font:16px system-ui}}main{{max-width:680px;margin:auto}}audio{{display:block;position:relative;z-index:1;width:100%;min-height:54px;margin:24px 0}}button{{padding:14px 18px}}</style></head><body><main><section data-randomware="loading" hidden>loading</section><h1>Signed audio check</h1><button id="play-audio" type="button">Play signed audio</button><section data-randomware="interactive"><audio id="audio" controls crossorigin="anonymous"></audio><p id="audio-status">Ready</p></section><section data-randomware="error" hidden>error</section><footer data-randomware="attribution">Randomware signed fixture audio.</footer></main><script>{script}</script><!-- {'audio-browser-check ' * 900} --></body></html>'''


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

        run_tag = f"{'local-showcase' if server else 'browser'}-{int(time.time() * 1000)}"
        _, run = call("/api/spin", {"seed": run_tag, "requestId": f"{run_tag}-spin"})
        concept = make_concept(run, f"{run_tag}-concept")
        if server:
            concept["appName"] = "Paperwork Oracle"
        concept["runId"] = run["runId"]
        status, _ = call(f"/api/runs/{run['runId']}/concept", concept)
        assert status == 200, f"concept_status:{status}"
        status, artifact = call(f"/api/runs/{run['runId']}/artifact", {"requestId": f"{run_tag}-artifact", "html": make_artifact(run)})
        assert status == 200, f"artifact_status:{status}"

        audio_artifact = None
        if REQUIRE_AUDIO:
            audio_run = None
            for index, audio_seed in enumerate(["media-audio-2", "contract-audio-20-8822", "contract-audio-20-9376"]):
                _, candidate = call("/api/spin", {"seed": audio_seed, "requestId": f"{run_tag}-audio-spin-{index}"})
                if any(entry["id"] == "radio-browser" for entry in candidate["selectedApis"]):
                    audio_run = candidate
                    break
            assert audio_run is not None, "browser_audio_selection_missing"
            audio_concept = make_concept(audio_run, f"{run_tag}-audio-concept")
            audio_concept["runId"] = audio_run["runId"]
            status, _ = call(f"/api/runs/{audio_run['runId']}/concept", audio_concept)
            assert status == 200, f"audio_concept_status:{status}"
            status, audio_artifact = call(f"/api/runs/{audio_run['runId']}/artifact", {"requestId": f"{run_tag}-audio-artifact", "html": make_audio_artifact(audio_run)})
            assert status == 200, f"audio_artifact_status:{status}"

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=CHROME if Path(CHROME).exists() else None)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            request_failures = []
            page.on("requestfailed", lambda request: request_failures.append({"url": request.url, "failure": request.failure}))
            response = page.goto(f"{BASE}/c/{artifact['creationId']}", wait_until="networkidle")
            csp = response.headers.get("content-security-policy", "")
            border_width = page.locator(".rw-chrome").evaluate("element => getComputedStyle(element).borderTopWidth")
            frame_height = page.locator("iframe.rw-frame").bounding_box()["height"]
            assert "style-src 'self'" in csp and "unsafe-inline" not in csp, f"owner_csp_not_strict:{csp}"
            assert page.locator("style").count() == 0, "inline_style_present"
            assert page.locator("script").count() == 0, "inline_script_present"
            assert border_width == "3px", f"unstyled_chrome:border={border_width}"
            assert page.locator(".rw-stamp").inner_text().lower() == "accepted · rev 1", "creation_stamp_missing"
            assert "RANDOMWARE SPECIMEN RECORD" in page.locator(".rw-kicker").first.inner_text(), "creation_record_kicker_missing"
            assert page.locator(".rw-style").is_visible(), "creation_style_cartridge_missing"
            assert frame_height >= 390, f"frame_too_short:{frame_height}"
            assert page.locator(".rw-site-header a").inner_text().endswith("Randomware showcase"), "creation_header_navigation_missing"
            assert page.locator(".rw-site-footer").inner_text().find("See other specimens") >= 0, "creation_footer_navigation_missing"
            assert page.locator(".rw-api-symbol").count() == len(run["selectedApis"]), "creation_api_symbols_missing"
            assert all(" — " in item.inner_text() for item in page.locator(".rw-api-list li").all()), "creation_capabilities_missing"
            artifact_frame = page.frame_locator("iframe.rw-frame")
            page.wait_for_timeout(500)
            frame_urls = [frame.url for frame in page.frames]
            assert any("/run/" in url for url in frame_urls), f"artifact_frame_not_loaded:{frame_urls}:failures={request_failures}"
            artifact_frame.locator("#reveal").wait_for(timeout=15000)
            artifact_frame.locator("#reveal").click()
            artifact_frame.locator("#semantic-values[data-semantic='complete']").wait_for(timeout=30000)
            semantic_text = artifact_frame.locator("#semantic-values").inner_text()
            assert "not loaded" not in semantic_text and "undefined" not in semantic_text and "NaN" not in semantic_text, f"semantic_values_defaulted:{semantic_text}"
            assert len([line for line in semantic_text.splitlines() if line.strip()]) == len(run["selectedApis"]), f"semantic_values_incomplete:{semantic_text}"

            desktop_page = browser.new_page(viewport={"width": 1280, "height": 900})
            desktop_page.goto(f"{BASE}/c/{artifact['creationId']}", wait_until="networkidle")
            desktop_frame_height = desktop_page.locator("iframe.rw-frame").bounding_box()["height"]
            assert desktop_frame_height >= 790, f"desktop_frame_budget_too_short:{desktop_frame_height}"
            requests_page = browser.new_page(viewport={"width": 390, "height": 844})
            requests_page.goto(f"{BASE}/api/creations/{artifact['creationId']}/requests", wait_until="domcontentloaded")
            assert requests_page.locator("table").is_visible(), "request_autopsy_table_missing"
            assert requests_page.locator("a[href='?format=raw']").is_visible(), "request_autopsy_raw_missing"
            dataflow_page = browser.new_page(viewport={"width": 390, "height": 844})
            dataflow_page.goto(f"{BASE}/api/creations/{artifact['creationId']}/dataflow", wait_until="domcontentloaded")
            assert dataflow_page.locator(".rw-dataflow").is_visible(), "dataflow_autopsy_missing"
            index_page = browser.new_page(viewport={"width": 390, "height": 844})
            index_page.goto(f"{BASE}/", wait_until="domcontentloaded")
            assert index_page.locator("#for-judges").is_visible(), "judge_bridge_missing"
            assert index_page.locator("a[href*='chatgpt-prerequisites-and-connect']").count() >= 1, "connect_link_missing"
            assert "Loading" not in index_page.locator("body").inner_text(), "index_not_server_rendered"
            assert "Browser Chrome Check" not in index_page.locator("body").inner_text(), "test_specimen_listed"
            assert index_page.locator(".hero-machine iframe").count() == 1, "index_live_hero_missing"

            audio_playback = None
            if REQUIRE_AUDIO:
                audio_page = browser.new_page(viewport={"width": 390, "height": 844})
                audio_page.goto(f"{BASE}/c/{audio_artifact['creationId']}", wait_until="networkidle")
                audio_frame = next((frame for frame in audio_page.frames if f"/run/{audio_artifact['creationId']}" in frame.url), None)
                assert audio_frame is not None, "signed_audio_frame_missing"
                audio_frame.locator("#play-audio").click()
                audio_frame.wait_for_function("() => { const audio = document.querySelector('#audio'); return audio && audio.currentTime > 0; }", timeout=15000)
                audio_playback = audio_frame.locator("#audio").evaluate("audio => { const rect=audio.getBoundingClientRect(); const top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2); return {currentTime:audio.currentTime,readyState:audio.readyState,networkState:audio.networkState,visible:rect.width>0&&rect.height>=40,unobstructed:top===audio||audio.contains(top)}; }")
                assert audio_playback["currentTime"] > 0, f"signed_audio_no_progress:{audio_playback}"
                assert audio_playback["visible"] and audio_playback["unobstructed"], f"signed_audio_controls_obstructed:{audio_playback}"

            widget_page = browser.new_page(viewport={"width": 390, "height": 844})
            now_ms = int(time.time() * 1000)
            spin_run = {"runId": "widget-run", "phase": "spinned", "styleId": "teletext", "style": {"id": "teletext", "name": "Teletext Dispatch", "symbol": "📟", "palette": "primary blocks", "typography": "fixed grid", "motion": "row reveal", "era": "Ceefax", "avoid": "keep controls visible"}, "statusUrl": f"{BASE}/api/runs/widget-run", "creationUrl": None, "choreography": {"phase": "concept", "startedAt": now_ms, "lastActivityAt": now_ms, "idleDeadlineAt": now_ms + 181000, "absoluteDeadlineAt": now_ms + 601000, "reSteered": False}, "selectedApis": [{"id": "frankfurter", "name": "Frankfurter", "operations": []}, {"id": "dog-ceo", "name": "Dog CEO", "operations": []}, {"id": "open-meteo", "name": "Open-Meteo", "operations": []}]}
            concept_run = {**spin_run, "phase": "concept_accepted"}
            complete_run = {**concept_run, "phase": "completed", "creationId": "widget-creation", "creationUrl": f"{BASE}/c/widget-creation"}
            envelope = lambda value: {"content": [{"type": "text", "text": "fixture result"}], "structuredContent": value}
            mount_output = json.dumps({"ok": True, "registry": 20})
            init_script = (
                "window.openai = {toolOutput: " + mount_output + ", widgetState: null, "
                "setWidgetState: state => window.__widgetState = state, "
                "callTool: async name => {"
                "if (name !== 'spin_apis') throw new Error('unexpected tool');"
                "setTimeout(() => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: " + mount_output + "}}})), 10);"
                "return " + json.dumps(envelope(spin_run)) + ";"
                "}, openExternal: arg => { window.__openedExternal = arg && arg.href; }};"
            )
            widget_page.add_init_script(init_script)
            foreign_widget_url = "https://web-sandbox.oaiusercontent.com/widget-fixture"
            widget_page.route(foreign_widget_url, lambda route: route.fulfill(status=200, content_type="text/html", body="<!doctype html>"))
            widget_page.goto(foreign_widget_url, wait_until="domcontentloaded")
            refreshed_run = {**spin_run, "choreography": {**spin_run["choreography"], "lastActivityAt": now_ms + 1000, "idleDeadlineAt": now_ms + 181000 + 1000}}
            status_requests = []
            def fulfill_status(route):
                status_requests.append(route.request.url)
                route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps(refreshed_run))
            widget_page.route(f"{BASE}/api/runs/widget-run", fulfill_status)
            _, widget_body = call("/mcp", {"jsonrpc": "2.0", "id": "widget-resource", "method": "resources/read", "params": {"uri": "ui://widget/randomware.html"}})
            widget_html = widget_body["result"]["contents"][0]["text"]
            widget_page.set_content(widget_html, wait_until="domcontentloaded")
            widget_page.locator("#spin").click()
            widget_page.wait_for_timeout(150)
            assert widget_page.locator("#apis .reel[data-state='shuffling']").count() == 3, "widget_reel_shuffle_missing"
            widget_page.evaluate("envelope => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: envelope}}}))", envelope(spin_run))
            widget_page.wait_for_timeout(650)
            assert widget_page.locator("#status").inner_text() != "The slot is ready.", "widget_reset_to_idle_after_callTool"
            assert widget_page.locator("#apis li").count() == 3, "widget_reels_not_rendered"
            assert widget_page.locator("#apis .reel[data-state='stopped']").count() == 1, "widget_reel_stop_missing"
            assert widget_page.locator("#apis .reel[data-state='shuffling']").count() == 2, "widget_reel_stagger_missing"
            assert "💱" in widget_page.locator("#apis .reel-symbol").nth(0).inner_text(), "widget_symbol_missing"
            assert "Frankfurter — get exchange rates" in widget_page.locator("#apis .reel-copy").nth(0).inner_text(), "widget_capability_missing"
            first_stop = int(widget_page.locator("#apis .reel").nth(0).get_attribute("data-stopped-at"))
            widget_page.wait_for_timeout(850)
            assert widget_page.locator("#apis .reel[data-state='stopped']").count() == 3, "widget_three_reel_stop_missing"
            stopped_at = [int(widget_page.locator("#apis .reel").nth(index).get_attribute("data-stopped-at")) for index in range(3)]
            assert stopped_at[0] == first_stop and stopped_at[0] < stopped_at[1] < stopped_at[2], f"widget_stop_order_failed:{stopped_at}"
            assert widget_page.locator("#apis").evaluate("element => element.classList.contains('is-flashing')"), "widget_full_stop_flash_missing"
            assert widget_page.locator("#lamps").evaluate("element => element.classList.contains('is-active')"), "widget_lamp_bank_missing"
            assert "STYLE CARTRIDGE: 📟 Teletext Dispatch" in widget_page.locator("#style-cartridge").inner_text(), "widget_style_chip_missing"
            assert widget_page.locator("#steps [data-step='concept']").get_attribute("data-state") == "current", "widget_stepper_concept_missing"
            assert widget_page.locator("#build").is_visible(), "widget_build_action_not_rendered"
            widget_page.locator("#build").click()
            assert widget_page.locator("#reassurance").is_visible(), "widget_session_reassurance_missing"
            assert "ELAPSED" in widget_page.locator("#elapsed").inner_text(), "widget_elapsed_missing"
            assert "AUTO-NUDGE AT" in widget_page.locator("#auto-nudge").inner_text(), "widget_auto_nudge_missing"
            assert "LAST SIGNAL" in widget_page.locator("#heartbeat").inner_text(), "widget_heartbeat_missing"
            assert widget_page.locator("#composing").is_visible(), "widget_composing_animation_missing"
            assert widget_page.locator("#fallback").is_visible(), "widget_follow_up_fallback_missing"
            fallback_prompt = widget_page.locator("#build-prompt").input_value()
            assert "Use Randomware run widget-run:" in fallback_prompt, "widget_fallback_run_id_missing"
            assert "submit the complete artifact via submit_artifact" in fallback_prompt, "widget_fallback_prompt_incomplete"
            assert widget_page.evaluate("window.__widgetState?.paused") is True, "widget_concept_timer_not_paused"
            widget_page.wait_for_timeout(3200)
            assert widget_page.evaluate("window.__widgetState?.choreography?.lastActivityAt") == now_ms + 1000, "widget_status_refresh_not_applied"
            assert status_requests and all(url.startswith(BASE) for url in status_requests), f"widget_status_used_foreign_origin:{status_requests}"
            widget_page.unroute(f"{BASE}/api/runs/widget-run")
            widget_page.route(f"{BASE}/api/runs/widget-run", lambda route: route.abort())
            widget_page.wait_for_timeout(9200)
            assert widget_page.locator("#status").inner_text() == "status polling unavailable", "widget_poll_failure_not_visible"
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
            assert widget_page.locator("#steps [data-step='build']").get_attribute("data-state") == "current", "widget_stepper_build_missing"
            widget_page.evaluate("envelope => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: envelope}}}))", envelope(complete_run))
            assert widget_page.locator("#creation").is_visible(), "widget_creation_section_missing"
            assert not widget_page.locator("#creation-frame").get_attribute("hidden"), "widget_creation_frame_not_embedded"
            assert widget_page.locator("#creation-frame").get_attribute("src") == f"{BASE}/c/widget-creation", "widget_creation_frame_wrong_origin"
            assert widget_page.locator("#creation-link").get_attribute("href") == f"{BASE}/c/widget-creation", "widget_creation_link_wrong_origin"
            widget_page.locator("#creation-link").dispatch_event("click")
            opened_external = widget_page.evaluate("window.__openedExternal")
            assert opened_external == f"{BASE}/c/widget-creation", f"widget_open_external_wrong_origin:{opened_external}"
            assert all(item.get_attribute("data-state") == "done" for item in widget_page.locator("#steps li").all()), "widget_stepper_boot_missing"
            terminal_failure = {**complete_run, "phase": "failed", "nextTool": "none", "creationId": "widget-failure", "creationUrl": f"{BASE}/c/widget-failure", "failure": {"code": "repair_failed"}, "revisions": [{"revision": 2, "status": "failed"}]}
            terminal_envelope = {"content": [{"type": "text", "text": "repair failed"}], "structuredContent": terminal_failure, "isError": True}
            widget_page.evaluate("envelope => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: envelope}}}))", terminal_envelope)
            assert widget_page.locator("#failure").is_visible(), "widget_terminal_failure_missing"
            assert "☒ BUILD DECEASED" in widget_page.locator("#failure-code").inner_text(), "widget_terminal_failure_heading_missing"
            assert "repair_failed" in widget_page.locator("#failure-copy").inner_text(), "widget_terminal_failure_code_missing"
            assert widget_page.locator("#failure-spin").is_visible(), "widget_failure_spin_missing"
            assert widget_page.locator("#autopsy").is_visible(), "widget_failure_autopsy_missing"
            precreation_failure = {**terminal_failure, "creationId": None, "creationUrl": None, "failure": {"code": "choreography_timeout"}, "revisions": []}
            widget_page.evaluate("envelope => window.dispatchEvent(new CustomEvent('openai:set_globals', {detail: {globals: {toolOutput: envelope}}}))", {"content": [{"type": "text", "text": "timeout"}], "structuredContent": precreation_failure, "isError": True})
            assert not widget_page.locator("#autopsy").is_visible(), "widget_false_autopsy_link_visible"
            assert widget_page.locator("#steps [data-step='concept']").get_attribute("data-state") == "failed", "widget_failure_step_missing"
            report_page = browser.new_page(viewport={"width": 390, "height": 844})
            report_page.goto(f"{BASE}/api/creations/{artifact['creationId']}/report", wait_until="domcontentloaded")
            assert report_page.locator("form").is_visible(), "report_confirm_missing"
            with report_page.expect_navigation():
                report_page.locator("button[type='submit']").click()
            assert "report received" in report_page.locator("body").inner_text().lower(), "report_post_failed"
            print(json.dumps({"ok": True, "borderTopWidth": border_width, "frameHeight": frame_height, "desktopFrameHeight": desktop_frame_height, "semanticValues": semantic_text.splitlines(), "audioPlayback": audio_playback, "widgetEnvelope": True, "widgetTransitions": True, "showcaseServerRendered": True, "autopsyTables": True}))
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
