print("Please wait..)
  task.wait(2)
  
local C = 16
local R = true

while R do
game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = 100
task.wait(10)
R = false
end

game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = 16

