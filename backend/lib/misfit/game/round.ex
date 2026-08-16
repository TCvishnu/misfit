defmodule Misfit.Game.Round do
  @moduledoc """
  One round of Misfit, as pure data plus transitions.

  Phase order: `:answering -> :reveal_main_question -> :discussion -> :voting -> :results`.

  The round holds *both* questions — the server needs the pair to decide what
  each player is shown. It must therefore never be serialised to a client
  directly. Everything the client sees goes through `Misfit.Game.Room.view_for/2`.
  """

  alias Misfit.Game.{Questions, Room}

  @answer_max_length 100
  @chat_max_length 200

  @phases [:answering, :reveal_main_question, :discussion, :voting, :results]

  @type status :: :answering | :reveal_main_question | :discussion | :voting | :results

  @type chat_message :: %{
          player_code: String.t(),
          text: String.t(),
          at: DateTime.t()
        }

  @type t :: %__MODULE__{
          round_number: pos_integer(),
          question: %{main: String.t(), misfit: String.t()},
          misfit_player_code: String.t(),
          answers: %{String.t() => String.t()},
          votes: %{String.t() => String.t()},
          chat: [chat_message()],
          status: status()
        }

  defstruct [
    :round_number,
    :question,
    :misfit_player_code,
    answers: %{},
    votes: %{},
    chat: [],
    status: :answering
  ]

  @spec new(Room.t(), pos_integer()) :: t()
  def new(%Room{} = room, round_number) do
    %__MODULE__{
      round_number: round_number,
      question: Questions.random_question(),
      misfit_player_code: choose_misfit(room)
    }
  end

  defp choose_misfit(%Room{players: players}) when map_size(players) > 0 do
    players |> Map.keys() |> Enum.random()
  end

  @doc """
  The question a given player was asked. The misfit gets the variant;
  everyone else gets the main question.
  """
  @spec question_for(t(), String.t()) :: String.t()
  def question_for(%__MODULE__{} = round, player_code) do
    if player_code == round.misfit_player_code do
      round.question.misfit
    else
      round.question.main
    end
  end

  @spec misfit?(t(), String.t()) :: boolean()
  def misfit?(%__MODULE__{} = round, player_code),
    do: player_code == round.misfit_player_code

  ## Answering

  @spec submit_answer(t(), String.t(), String.t()) ::
          {:ok, t()} | {:error, :wrong_phase | :already_answered | :invalid_answer}
  def submit_answer(%__MODULE__{status: status}, _player_code, _text) when status != :answering,
    do: {:error, :wrong_phase}

  def submit_answer(%__MODULE__{} = round, player_code, text) do
    cond do
      answered?(round, player_code) ->
        {:error, :already_answered}

      not valid_text?(text, @answer_max_length) ->
        {:error, :invalid_answer}

      true ->
        {:ok, %__MODULE__{round | answers: Map.put(round.answers, player_code, String.trim(text))}}
    end
  end

  @spec answered?(t(), String.t()) :: boolean()
  def answered?(%__MODULE__{} = round, player_code),
    do: Map.has_key?(round.answers, player_code)

  ## Discussion

  @spec add_chat_message(t(), String.t(), String.t()) ::
          {:ok, t()} | {:error, :wrong_phase | :invalid_message}
  def add_chat_message(%__MODULE__{status: status}, _player_code, _text)
      when status != :discussion,
      do: {:error, :wrong_phase}

  def add_chat_message(%__MODULE__{} = round, player_code, text) do
    if valid_text?(text, @chat_max_length) do
      message = %{
        player_code: player_code,
        text: String.trim(text),
        at: DateTime.utc_now()
      }

      {:ok, %__MODULE__{round | chat: [message | round.chat]}}
    else
      {:error, :invalid_message}
    end
  end

  @doc "Chat in the order it was sent (state stores it newest-first)."
  @spec chat_history(t()) :: [chat_message()]
  def chat_history(%__MODULE__{chat: chat}), do: Enum.reverse(chat)

  ## Voting

  @spec cast_vote(t(), String.t(), String.t()) ::
          {:ok, t()} | {:error, :wrong_phase | :already_voted | :cannot_vote_for_self}
  def cast_vote(%__MODULE__{status: status}, _voter, _accused) when status != :voting,
    do: {:error, :wrong_phase}

  def cast_vote(%__MODULE__{}, voter, voter), do: {:error, :cannot_vote_for_self}

  def cast_vote(%__MODULE__{} = round, voter, accused) do
    if Map.has_key?(round.votes, voter) do
      {:error, :already_voted}
    else
      {:ok, %__MODULE__{round | votes: Map.put(round.votes, voter, accused)}}
    end
  end

  @spec voted?(t(), String.t()) :: boolean()
  def voted?(%__MODULE__{} = round, player_code), do: Map.has_key?(round.votes, player_code)

  @doc "Vote counts per accused player."
  @spec tally(t()) :: %{String.t() => pos_integer()}
  def tally(%__MODULE__{votes: votes}) do
    Enum.reduce(votes, %{}, fn {_voter, accused}, acc ->
      Map.update(acc, accused, 1, &(&1 + 1))
    end)
  end

  @doc """
  The player(s) with the most votes. A tie returns every tied player, and
  no votes at all returns an empty list.
  """
  @spec accused(t()) :: [String.t()]
  def accused(%__MODULE__{} = round) do
    case tally(round) do
      counts when map_size(counts) == 0 ->
        []

      counts ->
        max = counts |> Map.values() |> Enum.max()

        counts
        |> Enum.filter(fn {_code, count} -> count == max end)
        |> Enum.map(&elem(&1, 0))
    end
  end

  @spec caught?(t()) :: boolean()
  def caught?(%__MODULE__{} = round), do: round.misfit_player_code in accused(round)

  @doc """
  Points earned this round, per player.

    * misfit caught      -> every player who voted for them scores 2
    * misfit escapes     -> misfit scores 3
    * clean frame        -> misfit scores 1 more, when exactly one innocent
                            player took the most votes
  """
  @spec score_deltas(t()) :: %{String.t() => pos_integer()}
  def score_deltas(%__MODULE__{} = round) do
    accused = accused(round)
    misfit = round.misfit_player_code

    if misfit in accused do
      round.votes
      |> Enum.filter(fn {_voter, voted_for} -> voted_for == misfit end)
      |> Map.new(fn {voter, _} -> {voter, 2} end)
    else
      framed? = match?([_single], accused)
      %{misfit => if(framed?, do: 4, else: 3)}
    end
  end

  ## Phase transitions

  @doc "Advance to the next phase. `:results` is terminal for a round."
  @spec advance(t()) :: {:ok, t()} | {:error, :round_over}
  def advance(%__MODULE__{status: :results}), do: {:error, :round_over}

  def advance(%__MODULE__{} = round) do
    next = Enum.at(@phases, phase_index(round.status) + 1)
    {:ok, %__MODULE__{round | status: next}}
  end

  @doc "True once the round has reached the phase where answers are public."
  @spec main_question_revealed?(t()) :: boolean()
  def main_question_revealed?(%__MODULE__{status: status}), do: phase_index(status) >= phase_index(:reveal_main_question)

  defp phase_index(status), do: Enum.find_index(@phases, &(&1 == status))

  defp valid_text?(text, max) when is_binary(text) do
    trimmed = String.trim(text)
    trimmed != "" and String.length(trimmed) <= max
  end

  defp valid_text?(_text, _max), do: false
end
