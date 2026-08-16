defmodule Misfit.Game.RoomTest do
  use ExUnit.Case, async: true

  alias Misfit.Game.{Player, Room, Round}

  defp room_with(names) do
    Enum.reduce(names, Room.new(), fn name, room ->
      {:ok, room} = Room.add_player(room, Player.new(name))
      room
    end)
  end

  defp started(names) do
    {:ok, room} = names |> room_with() |> Room.start_game()
    room
  end

  defp codes(room), do: Map.keys(room.players)
  defp misfit(room), do: Room.current_round(room).misfit_player_code
  defp innocents(room), do: codes(room) -- [misfit(room)]

  defp everyone_answers(room) do
    Enum.reduce(codes(room), room, fn code, room ->
      {:ok, room} = Room.submit_answer(room, code, "answer from #{code}")
      room
    end)
  end

  defp advance_to(room, phase) do
    if Room.current_round(room).status == phase do
      room
    else
      {:ok, room} = Room.advance_phase(room)
      advance_to(room, phase)
    end
  end

  describe "start_game/1" do
    test "refuses below the minimum player count" do
      assert {:error, :not_enough_players} = ["solo"] |> room_with() |> Room.start_game()
    end

    test "opens round 1 in the answering phase" do
      room = started(["A", "B", "C"])

      assert room.status == :in_play
      assert room.current_round == 1
      assert Room.current_round(room).status == :answering
      assert misfit(room) in codes(room)
    end
  end

  describe "submit_answer/3" do
    test "records an answer and reports completion" do
      room = started(["A", "B"])
      [a, b] = codes(room)

      {:ok, room} = Room.submit_answer(room, a, "pineapple")
      refute Room.all_answered?(room)

      {:ok, room} = Room.submit_answer(room, b, "regret")
      assert Room.all_answered?(room)
    end

    test "rejects blank answers, repeats, strangers, and the wrong phase" do
      room = started(["A", "B"])
      [a, _b] = codes(room)

      assert {:error, :invalid_answer} = Room.submit_answer(room, a, "   ")
      assert {:error, :unknown_player} = Room.submit_answer(room, "ghost", "hi")

      {:ok, room} = Room.submit_answer(room, a, "first")
      assert {:error, :already_answered} = Room.submit_answer(room, a, "second")

      voting = advance_to(room, :voting)
      assert {:error, :wrong_phase} = Room.submit_answer(voting, a, "late")
    end
  end

  describe "the misfit's question" do
    test "differs from everyone else's" do
      room = started(["A", "B", "C"])
      round = Room.current_round(room)

      for code <- innocents(room) do
        assert Round.question_for(round, code) == round.question.main
      end

      assert Round.question_for(round, misfit(room)) == round.question.misfit
      refute round.question.main == round.question.misfit
    end
  end

  describe "chat" do
    test "is only open during discussion" do
      room = started(["A", "B"])
      [a, _] = codes(room)

      assert {:error, :wrong_phase} = Room.add_chat_message(room, a, "too early")

      room = advance_to(room, :discussion)
      {:ok, room} = Room.add_chat_message(room, a, "it's obviously B")
      {:ok, room} = Room.add_chat_message(room, a, "look at that answer")

      assert ["it's obviously B", "look at that answer"] =
               room |> Room.current_round() |> Round.chat_history() |> Enum.map(& &1.text)
    end
  end

  describe "cast_vote/3" do
    test "rejects self-votes, repeats and the wrong phase" do
      room = started(["A", "B"]) |> everyone_answers()
      [a, b] = codes(room)

      assert {:error, :wrong_phase} = Room.cast_vote(room, a, b)

      room = advance_to(room, :voting)
      assert {:error, :cannot_vote_for_self} = Room.cast_vote(room, a, a)

      {:ok, room} = Room.cast_vote(room, a, b)
      assert {:error, :already_voted} = Room.cast_vote(room, a, b)
      refute Room.all_voted?(room)

      {:ok, room} = Room.cast_vote(room, b, a)
      assert Room.all_voted?(room)
    end
  end

  describe "scoring" do
    test "everyone who catches the misfit scores 2" do
      room = started(["A", "B", "C"]) |> everyone_answers() |> advance_to(:voting)
      the_misfit = misfit(room)

      room =
        Enum.reduce(innocents(room), room, fn code, room ->
          {:ok, room} = Room.cast_vote(room, code, the_misfit)
          room
        end)

      {:ok, room} = Room.cast_vote(room, the_misfit, hd(innocents(room)))
      {:ok, room} = Room.advance_phase(room)

      assert Room.current_round(room).status == :results
      assert Round.caught?(Room.current_round(room))

      for code <- innocents(room), do: assert(room.players[code].score == 2)
      assert room.players[the_misfit].score == 0
    end

    test "an escaping misfit scores 3, or 4 for a clean frame" do
      room = started(["A", "B", "C"]) |> everyone_answers() |> advance_to(:voting)
      the_misfit = misfit(room)
      [patsy, other] = innocents(room)

      # Everyone piles onto one innocent player.
      {:ok, room} = Room.cast_vote(room, the_misfit, patsy)
      {:ok, room} = Room.cast_vote(room, other, patsy)
      {:ok, room} = Room.cast_vote(room, patsy, other)
      {:ok, room} = Room.advance_phase(room)

      refute Round.caught?(Room.current_round(room))
      assert room.players[the_misfit].score == 4
    end

    test "no votes at all means the misfit escapes" do
      room =
        started(["A", "B"])
        |> everyone_answers()
        |> advance_to(:voting)

      {:ok, room} = Room.advance_phase(room)

      refute Round.caught?(Room.current_round(room))
      assert room.players[misfit(room)].score == 3
    end
  end

  describe "next_round/1" do
    test "refuses mid-round, then opens a fresh round" do
      room = started(["A", "B"]) |> everyone_answers()
      assert {:error, :round_in_progress} = Room.next_round(room)

      {:ok, room} = room |> advance_to(:results) |> Room.next_round()

      assert room.current_round == 2
      assert Room.current_round(room).status == :answering
      assert Room.current_round(room).answers == %{}
    end

    test "finishes the game after max_rounds" do
      room = %Room{started(["A", "B"]) | max_rounds: 1}
      {:ok, room} = room |> everyone_answers() |> advance_to(:results) |> Room.next_round()

      assert room.status == :finished
      assert {:error, :game_over} = Room.next_round(room)
    end
  end

  describe "view_for/2" do
    test "never leaks the misfit or their question before results" do
      room = started(["A", "B", "C"])
      round = Room.current_round(room)

      for phase <- [:answering, :reveal_main_question, :discussion, :voting] do
        room = advance_to(room, phase)

        for code <- codes(room) do
          view = Room.view_for(room, code)

          refute Map.has_key?(view.round, :misfit_player_code)
          refute view.round.question == round.question.misfit

          # Only the misfit is ever shown the variant question, and only as
          # their own `your_question`.
          if view.round.your_question == round.question.misfit do
            assert code == misfit(room)
          end
        end
      end
    end

    test "hides answers until reveal, then shows them to everyone" do
      room = started(["A", "B"]) |> everyone_answers()
      [a, _] = codes(room)

      assert Room.view_for(room, a).round.answers == []
      assert Room.view_for(room, a).round.answered_count == 2

      room = advance_to(room, :reveal_main_question)
      view = Room.view_for(room, a)

      assert length(view.round.answers) == 2
      assert view.round.question == Room.current_round(room).question.main
    end

    test "reveals the misfit and the tally at results" do
      room = started(["A", "B"]) |> everyone_answers() |> advance_to(:voting)
      [a, b] = codes(room)

      {:ok, room} = Room.cast_vote(room, a, b)
      {:ok, room} = Room.advance_phase(room)

      view = Room.view_for(room, a)

      assert view.round.misfit_player_code == misfit(room)
      assert view.round.you_were_misfit == (a == misfit(room))
      assert view.round.tally == %{b => 1}
      assert view.round.accused == [b]
    end
  end
end
