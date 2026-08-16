defmodule Misfit.Game.Round do
  alias Misfit.Game.{Questions, Room}

  defstruct [:round_number, :question, :answers, :misfit_player_code]

  def new(%Room{} = room, round_number) do
    %Misfit.Game.Round{
      round_number: round_number,
      question: Questions.random_question(),
      answers: %{},
      misfit_player_code: choose_a_misfit_player(room)
    }
  end

  defp choose_a_misfit_player(room) do
    room.players
    |> Map.keys()
    |> Enum.random()
  end
end
