-- panic() terminates the session (the AAP ending calls panic() last).
require("edgeware_v0")
print("PANIC-TEST begin")
after(50, function()
    panic()
end)
