defmodule Misfit.Game.Player do
  defstruct [:name, :player_code]

  def new(name) do
    %Misfit.Game.Player{
      name: name,
      player_code: generate_player_code()
    }
  end

  defp generate_player_code do
    random = Base.encode16(:crypto.strong_rand_bytes(4))
    "player_" <> random
  end
end
