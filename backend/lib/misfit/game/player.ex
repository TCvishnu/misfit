defmodule Misfit.Game.Player do
  @type t :: %__MODULE__{
          name: String.t(),
          player_code: String.t(),
          score: non_neg_integer()
        }

  defstruct [:name, :player_code, score: 0]

  @spec new(String.t()) :: t()
  def new(name) do
    %__MODULE__{name: name, player_code: generate_player_code()}
  end

  @spec add_score(t(), integer()) :: t()
  def add_score(%__MODULE__{} = player, points) do
    %__MODULE__{player | score: player.score + points}
  end

  defp generate_player_code do
    "player_" <> Base.encode16(:crypto.strong_rand_bytes(4))
  end
end
