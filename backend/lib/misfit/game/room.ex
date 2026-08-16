defmodule Misfit.Game.Room do
  alias Misfit.Game.{Player, Round}

  defstruct [
    :room_code,
    :status,
    :players,
    :rounds,
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
    random_number = :rand.uniform(999_999) |> Integer.to_string() |> String.pad_leading(4, "0")
    random_word <> "-" <> random_number
  end

  @spec add_player(%__MODULE__{}, %Player{}) :: {:ok, %__MODULE__{}} | {:error, :room_full}
  def add_player(%__MODULE__{} = room, %Player{} = player) do
    case length(Map.keys(room.players)) do
      n when n < room.max_players ->
        updated_players = Map.put(room.players, player.player_code, player)
        {:ok, %__MODULE__{room | players: updated_players}}

      _ ->
        {:error, :room_full}
    end
  end

  @spec remove_player(%__MODULE__{}, %Player{}) :: {:ok, %__MODULE__{}}
  def remove_player(%__MODULE__{} = room, %Player{} = player) do
    updated_players = Map.delete(room.players, player.player_code)
    {:ok, %__MODULE__{room | players: updated_players}}
  end

  @spec start_game(%__MODULE__{}) :: {:ok, %__MODULE__{}} | {:error, :not_enough_players}
  def start_game(%__MODULE__{} = room) do
    case length(Map.keys(room.players)) do
      n when n >= room.min_players ->
        updated_room = %__MODULE__{room | status: :in_play, current_round: 1, rounds: %{1 => Round.new(room, 1)}}
        {:ok, updated_room}

      _ ->
        {:error, :not_enough_players}
    end
  end
end
