-- edgeware_v0 API validation script.
--
-- Exercises every scripting function the Addict Acceptance Program pack
-- relies on: require, print, roll, after (with callback chains and global
-- function reassignment), set_popup_close_text, image, video, audio with an
-- on_stop callback, prompt with an on_close callback, subliminal, web,
-- notification, corrupt (advancing corruption levels) and close_popups
-- releasing pending callbacks. Each step logs an "API-TEST <name>" marker.

require("edgeware_v0")
print("API-TEST require")

-- roll: deterministic bounds of the percentage roll.
assert(roll(100) == true, "roll(100) must be true")
assert(roll(0) == false, "roll(0) must be false")
print("API-TEST roll")

-- after: delayed callbacks, closures and global function callbacks
-- (the voice-chain pattern).
local base_after = after
local chained = 0
function global_step()
    chained = chained + 1
    print("API-TEST after", chained)
end
base_after(30, global_step)
base_after(90, function()
    assert(chained == 1, "after callbacks must run in registration order")
    print("API-TEST after_chain")
end)

-- set_popup_close_text: overrides the media popup close label.
set_popup_close_text("API-TEST close-text")
print("API-TEST set_popup_close_text")

-- image / video with nil: random pack media (multiple_popups pattern).
image(nil)
video(nil)
print("API-TEST image_video")

-- audio with an on_stop callback (the voice_N -> voice_N+1 chain).
audio_stopped = false
function on_audio_stop()
    audio_stopped = true
    print("API-TEST audio_on_stop")
end
audio(nil, on_audio_stop)
print("API-TEST audio")

-- prompt with an on_close callback (the voice_15 join pattern).
prompt_closed = false
function on_prompt_close()
    prompt_closed = true
    print("API-TEST prompt_on_close")
end
prompt(nil, on_prompt_close)
print("API-TEST prompt")

-- subliminal: full-screen text popup (the countdown pattern).
subliminal("API-TEST SUBLIMINAL")
print("API-TEST subliminal")

-- web with an explicit url (the ending links pattern).
web("https://example.com/")
print("API-TEST web")

-- notification: system notification with explicit text.
notification("API-TEST notification")
print("API-TEST notification")

-- corrupt: each call advances the corruption level (every voice_N calls it).
corrupt()
assert(corruption.getCurrentLevel() == 1, "corrupt() must advance to level 1")
corrupt()
assert(corruption.getCurrentLevel() == 2, "corrupt() must advance to level 2")
print("API-TEST corrupt")

-- close_popups: closing the media popups must release the pending
-- audio/prompt callbacks (the voice_12 pattern).
after(250, function()
    close_popups()
    after(500, function()
        assert(audio_stopped, "audio on_stop must fire when its popup closes")
        assert(prompt_closed, "prompt on_close must fire when its popup closes")
        print("API-TEST close_popups")
        print("API-TEST done")
    end)
end)
