defmodule Misfit.Game.Room do
  alias Misfit.Game.{Player, Round}

  @type status :: :waiting | :in_play | :finished

  @type t :: %__MODULE__{
          room_code: String.t(),
          status: status(),
          players: %{String.t() => Player.t()},
          rounds: %{pos_integer() => Round.t()},
          max_players: pos_integer(),
          min_players: pos_integer(),
          max_rounds: pos_integer(),
          current_round: non_neg_integer()
        }

  defstruct [
    :room_code,
    status: :waiting,
    players: %{},
    rounds: %{},
    max_players: 8,
    min_players: 2,
    max_rounds: 5,
    current_round: 0
  ]

  @room_words [
    "PANDA",
    "TIGER",
    "MANGO",
    "ROCKET",
    "NINJA",
    "PIZZA",
    "WHALE",
    "EAGLE",
    "BUNNY",
    "GHOST",
    "DRAGON",
    "MONKEY",
    "TURTLE",
    "WIZARD",
    "PIRATE",
    "VAMPIRE",
    "ROBOT",
    "ALIEN",
    "ZOMBIE",
    "UNICORN",
    "COBRA",
    "FALCON",
    "SHARK",
    "WOLF",
    "BEAR",
    "FOX",
    "OTTER",
    "KOALA",
    "PENGUIN",
    "DOLPHIN",
    "BANANA",
    "CHERRY",
    "PEACH",
    "LEMON",
    "COOKIE",
    "DONUT",
    "WAFFLE",
    "TACO",
    "BURGER",
    "NOODLE",
    "POPCORN",
    "CHEESE",
    "BUBBLE",
    "CLOUD",
    "THUNDER",
    "STORM",
    "COMET",
    "MOON",
    "SUNSET",
    "VOLCANO",
    "CASTLE",
    "TEMPLE",
    "JUNGLE",
    "DESERT",
    "ISLAND",
    "OCEAN",
    "FOREST",
    "CANYON",
    "RIVER",
    "ROSE",
    "DIAMOND",
    "RUBY",
    "GOLD",
    "SILVER",
    "MAGIC",
    "LASER",
    "RODEO",
    "SAMURAI",
    "VIKING",
    "HERO",
    "BISON",
    "MOOSE",
    "BADGER",
    "PARROT",
    "PEACOCK",
    "FLAMINGO",
    "PUMPKIN",
    "MELON",
    "COCONUT",
    "PINEAPPLE",
    "AVOCADO",
    "PANCAKE",
    "MUFFIN",
    "BROWNIE",
    "CUPCAKE",
    "CARAMEL",
    "JELLY",
    "CANDY",
    "BOLT",
    "SPARK",
    "FLAME",
    "FROST",
    "SHADOW",
    "MYSTERY",
    "CHAOS",
    "THUNDER",
    "PHOENIX",
    "WARRIOR",
    "NUGGET",
    "BANJO"
  ]

  def new do
    %__MODULE__{
      room_code: generate_room_code(),
      status: :waiting,
      players: %{},
      rounds: %{}
    }
  end

  defp generate_room_code do
    random_word = @room_words |> Enum.random() |> String.downcase()
    random_number = :rand.uniform(999_999) |> Integer.to_string() |> String.pad_leading(6, "0")
    random_word <> "-" <> random_number
  end

  @spec add_player(%__MODULE__{}, %Player{}) :: {:ok, %__MODULE__{}} | {:error, :room_full}
  def add_player(%__MODULE__{} = room, %Player{} = player) do
    case player_count(room) do
      n when n < room.max_players ->
        updated_players = Map.put(room.players, player.player_code, player)
        {:ok, %__MODULE__{room | players: updated_players}}

      _ ->
        {:error, :room_full}
    end
  end

  @spec remove_player(%__MODULE__{}, String.t()) :: {:ok, %__MODULE__{}}
  def remove_player(%__MODULE__{} = room, player_code) do
    updated_players = Map.delete(room.players, player_code)
    {:ok, %__MODULE__{room | players: updated_players}}
  end

  @spec start_game(%__MODULE__{}) :: {:ok, %__MODULE__{}} | {:error, :not_enough_players}
  def start_game(%__MODULE__{} = room) do
    case player_count(room) do
      n when n >= room.min_players ->
        updated_room = %__MODULE__{room | status: :in_play, current_round: 1, rounds: %{1 => Round.new(room, 1)}}
        {:ok, updated_room}

      _ ->
        {:error, :not_enough_players}
    end
  end

  @spec player_count(t()) :: non_neg_integer()
  def player_count(%__MODULE__{players: players}), do: map_size(players)

  @spec current_round(t()) :: Round.t() | nil
  def current_round(%__MODULE__{} = room), do: room.rounds[room.current_round]

  ## Phase progression

  @doc """
  Move the current round to its next phase. Entering `:results` also applies
  that round's score deltas to the players.
  """
  @spec advance_phase(t()) :: {:ok, t()} | {:error, :no_active_round | :round_over}
  def advance_phase(%__MODULE__{} = room) do
    with {:ok, round} <- fetch_round(room),
         {:ok, advanced} <- Round.advance(round) do
      room = put_in(room.rounds[room.current_round], advanced)

      case advanced.status do
        :results -> {:ok, apply_scores(room, advanced)}
        _ -> {:ok, room}
      end
    end
  end

  @doc "Start the next round, or finish the game once `max_rounds` are played."
  @spec next_round(t()) :: {:ok, t()} | {:error, :round_in_progress | :game_over}
  def next_round(%__MODULE__{status: :finished}), do: {:error, :game_over}

  def next_round(%__MODULE__{} = room) do
    with {:ok, round} <- fetch_round(room) do
      cond do
        round.status != :results ->
          {:error, :round_in_progress}

        room.current_round >= room.max_rounds ->
          {:ok, %__MODULE__{room | status: :finished}}

        true ->
          number = room.current_round + 1

          {:ok,
           %__MODULE__{
             room
             | current_round: number,
               rounds: Map.put(room.rounds, number, Round.new(room, number))
           }}
      end
    end
  end

  defp apply_scores(%__MODULE__{} = room, %Round{} = round) do
    players =
      Enum.reduce(Round.score_deltas(round), room.players, fn {code, points}, players ->
        case players[code] do
          nil -> players
          player -> Map.put(players, code, Player.add_score(player, points))
        end
      end)

    %__MODULE__{room | players: players}
  end

  ## Player actions

  @spec submit_answer(t(), String.t(), String.t()) :: {:ok, t()} | {:error, atom()}
  def submit_answer(%__MODULE__{} = room, player_code, text) do
    with :ok <- ensure_player(room, player_code),
         {:ok, round} <- fetch_round(room),
         {:ok, round} <- Round.submit_answer(round, player_code, text) do
      {:ok, put_in(room.rounds[room.current_round], round)}
    end
  end

  @spec add_chat_message(t(), String.t(), String.t()) :: {:ok, t()} | {:error, atom()}
  def add_chat_message(%__MODULE__{} = room, player_code, text) do
    with :ok <- ensure_player(room, player_code),
         {:ok, round} <- fetch_round(room),
         {:ok, round} <- Round.add_chat_message(round, player_code, text) do
      {:ok, put_in(room.rounds[room.current_round], round)}
    end
  end

  @spec cast_vote(t(), String.t(), String.t()) :: {:ok, t()} | {:error, atom()}
  def cast_vote(%__MODULE__{} = room, voter_code, accused_code) do
    with :ok <- ensure_player(room, voter_code),
         :ok <- ensure_player(room, accused_code),
         {:ok, round} <- fetch_round(room),
         {:ok, round} <- Round.cast_vote(round, voter_code, accused_code) do
      {:ok, put_in(room.rounds[room.current_round], round)}
    end
  end

  @doc "True once every player in the room has answered the current round."
  @spec all_answered?(t()) :: boolean()
  def all_answered?(%__MODULE__{} = room), do: all_players?(room, &Round.answered?/2)

  @doc "True once every player in the room has voted in the current round."
  @spec all_voted?(t()) :: boolean()
  def all_voted?(%__MODULE__{} = room), do: all_players?(room, &Round.voted?/2)

  defp all_players?(%__MODULE__{} = room, check) do
    case current_round(room) do
      nil -> false
      round -> Enum.all?(Map.keys(room.players), &check.(round, &1))
    end
  end

  ## Client projection

  @doc """
  The only sanctioned way to build a payload for a client.

  Round state holds both questions and the misfit's identity, so it must never
  be sent as-is. Everything a player may see is assembled here — nothing else
  should build client payloads.
  """
  @spec view_for(t(), String.t()) :: map()
  def view_for(%__MODULE__{} = room, player_code) do
    %{
      room_code: room.room_code,
      status: room.status,
      current_round: room.current_round,
      max_rounds: room.max_rounds,
      players:
        room.players
        |> Map.values()
        |> Enum.sort_by(& &1.name)
        |> Enum.map(&%{player_code: &1.player_code, name: &1.name, score: &1.score}),
      round: round_view(current_round(room), room, player_code)
    }
  end

  defp round_view(nil, _room, _player_code), do: nil

  defp round_view(%Round{} = round, room, player_code) do
    revealed? = Round.main_question_revealed?(round)

    base = %{
      number: round.round_number,
      phase: round.status,
      # Your own question is always yours to see. The shared question appears
      # only at reveal — that moment is how the misfit finds out.
      your_question: Round.question_for(round, player_code),
      question: if(revealed?, do: round.question.main),
      you_answered: Round.answered?(round, player_code),
      you_voted: Round.voted?(round, player_code),
      your_vote: round.votes[player_code],
      answered_count: map_size(round.answers),
      voted_count: map_size(round.votes),
      answers: if(revealed?, do: answers_view(round, room), else: []),
      chat: if(revealed?, do: chat_view(round, room), else: [])
    }

    if round.status == :results do
      Map.merge(base, %{
        misfit_player_code: round.misfit_player_code,
        you_were_misfit: Round.misfit?(round, player_code),
        tally: Round.tally(round),
        accused: Round.accused(round),
        caught: Round.caught?(round),
        score_deltas: Round.score_deltas(round)
      })
    else
      base
    end
  end

  defp answers_view(%Round{} = round, %__MODULE__{} = room) do
    round.answers
    |> Enum.map(fn {code, text} ->
      %{player_code: code, name: player_name(room, code), text: text}
    end)
    |> Enum.sort_by(& &1.name)
  end

  defp chat_view(%Round{} = round, %__MODULE__{} = room) do
    round
    |> Round.chat_history()
    |> Enum.map(&Map.put(&1, :name, player_name(room, &1.player_code)))
  end

  defp player_name(%__MODULE__{} = room, code) do
    case room.players[code] do
      nil -> "(left)"
      player -> player.name
    end
  end

  defp fetch_round(%__MODULE__{} = room) do
    case current_round(room) do
      nil -> {:error, :no_active_round}
      round -> {:ok, round}
    end
  end

  defp ensure_player(%__MODULE__{} = room, player_code) do
    if Map.has_key?(room.players, player_code), do: :ok, else: {:error, :unknown_player}
  end
end
