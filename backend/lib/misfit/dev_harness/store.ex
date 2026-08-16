defmodule Misfit.DevHarness.Store do
  @moduledoc """
  THROWAWAY dev scaffolding — delete this once real rooms exist.

  A single `Agent` holding every room in one map, so the pure rules can be
  driven from a browser before any of the real process layer exists.

  Deliberately *not* how the game should work: one process for all rooms is a
  global bottleneck and a single point of failure. The real design is a
  supervised process per room, addressed through a `Registry`.
  """

  use Agent

  alias Misfit.Game.Room

  def start_link(_opts), do: Agent.start_link(fn -> %{} end, name: __MODULE__)

  @spec create_room() :: Room.t()
  def create_room do
    room = Room.new()
    Agent.update(__MODULE__, &Map.put(&1, room.room_code, room))
    room
  end

  @spec fetch(String.t()) :: {:ok, Room.t()} | {:error, :room_not_found}
  def fetch(code) do
    case Agent.get(__MODULE__, &Map.fetch(&1, code)) do
      {:ok, room} -> {:ok, room}
      :error -> {:error, :room_not_found}
    end
  end

  @doc """
  Apply a `Room -> {:ok, Room} | {:error, reason}` function to a stored room,
  persisting the result only when it succeeds.
  """
  @spec update(String.t(), (Room.t() -> {:ok, Room.t()} | {:error, atom()})) ::
          {:ok, Room.t()} | {:error, atom()}
  def update(code, fun) do
    Agent.get_and_update(__MODULE__, fn rooms ->
      with {:ok, room} <- Map.fetch(rooms, code),
           {:ok, updated} <- fun.(room) do
        {{:ok, updated}, Map.put(rooms, code, updated)}
      else
        :error -> {{:error, :room_not_found}, rooms}
        {:error, reason} -> {{:error, reason}, rooms}
      end
    end)
  end
end
