defmodule MisfitWeb.DevHarnessController do
  @moduledoc """
  THROWAWAY dev scaffolding — delete this alongside `Misfit.DevHarness.Store`.

  Plain request/response JSON over the pure rules so the game can be played in
  a few browser tabs. The real transport is a channel that pushes state; here
  the client just polls.
  """

  use MisfitWeb, :controller

  alias Misfit.DevHarness.Store
  alias Misfit.Game.{Player, Room}

  def create(conn, _params) do
    room = Store.create_room()
    json(conn, %{room_code: room.room_code})
  end

  def join(conn, %{"code" => code, "name" => name}) do
    player = Player.new(name)

    case Store.update(code, &Room.add_player(&1, player)) do
      {:ok, _room} -> json(conn, %{player_code: player.player_code, name: player.name})
      {:error, reason} -> failure(conn, reason)
    end
  end

  def show(conn, %{"code" => code, "player_code" => player_code}) do
    case Store.fetch(code) do
      {:ok, room} -> json(conn, Room.view_for(room, player_code))
      {:error, reason} -> failure(conn, reason)
    end
  end

  def start(conn, %{"code" => code}),
    do: mutate(conn, code, &Room.start_game/1)

  def answer(conn, %{"code" => code, "player_code" => player_code, "text" => text}),
    do: mutate(conn, code, &Room.submit_answer(&1, player_code, text))

  def chat(conn, %{"code" => code, "player_code" => player_code, "text" => text}),
    do: mutate(conn, code, &Room.add_chat_message(&1, player_code, text))

  def vote(conn, %{"code" => code, "player_code" => player_code, "accused" => accused}),
    do: mutate(conn, code, &Room.cast_vote(&1, player_code, accused))

  def advance(conn, %{"code" => code}),
    do: mutate(conn, code, &Room.advance_phase/1)

  def next_round(conn, %{"code" => code}),
    do: mutate(conn, code, &Room.next_round/1)

  def leave(conn, %{"code" => code, "player_code" => player_code}),
    do: mutate(conn, code, &Room.remove_player(&1, player_code))

  defp mutate(conn, code, fun) do
    case Store.update(code, fun) do
      {:ok, _room} -> json(conn, %{ok: true})
      {:error, reason} -> failure(conn, reason)
    end
  end

  defp failure(conn, reason) do
    status = if reason == :room_not_found, do: :not_found, else: :unprocessable_entity

    conn
    |> put_status(status)
    |> json(%{error: to_string(reason)})
  end
end
