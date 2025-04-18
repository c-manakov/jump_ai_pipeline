defmodule JumpAiPipeline.AnalyticsTest do
  use ExUnit.Case, async: true
  alias JumpAiPipeline.Analytics
  alias JumpAiPipeline.Analytics.Plug.Analytics, as: AnalyticsPlug

  describe "validate_analytics_data/1" do
    test "returns ok when data has required fields" do
      data = %{user_id: "user1", timestamp: 123456789}
      assert {:ok, ^data} = Analytics.validate_analytics_data(data)
    end

    test "returns error when data is missing required fields" do
      data = %{user_id: "user1"}
      assert {:error, "Invalid data format"} = Analytics.validate_analytics_data(data)

      data = %{timestamp: 123456789}
      assert {:error, "Invalid data format"} = Analytics.validate_analytics_data(data)
      
      data = %{}
      assert {:error, "Invalid data format"} = Analytics.validate_analytics_data(data)
    end

    test "returns error when data is not a map" do
      assert {:error, "Invalid data format"} = Analytics.validate_analytics_data("not a map")
      assert {:error, "Invalid data format"} = Analytics.validate_analytics_data(123)
      assert {:error, "Invalid data format"} = Analytics.validate_analytics_data(nil)
    end
  end

  describe "Plug.Analytics.track_request/2" do
    test "returns the conn unchanged" do
      conn = %{test: "connection"}
      assert conn == AnalyticsPlug.track_request(conn, [])
    end
  end

  describe "calculate_popular_books/2" do
    test "returns top 10 popular books based on checkout frequency" do
      # Create test data with timestamps within the time period
      now = DateTime.utc_now()
      one_month_ago = DateTime.add(now, -30, :day)
      
      time_period = %{start: one_month_ago, end: now}
      
      checkout_data = [
        %{book_id: "book1", timestamp: DateTime.add(now, -5, :day)},
        %{book_id: "book1", timestamp: DateTime.add(now, -10, :day)},
        %{book_id: "book1", timestamp: DateTime.add(now, -15, :day)},
        %{book_id: "book2", timestamp: DateTime.add(now, -7, :day)},
        %{book_id: "book2", timestamp: DateTime.add(now, -12, :day)},
        %{book_id: "book3", timestamp: DateTime.add(now, -8, :day)},
        %{book_id: "book4", timestamp: DateTime.add(now, -20, :day)},
        %{book_id: "book5", timestamp: DateTime.add(now, -25, :day)},
        # Add some books outside the time period that should be filtered out
        %{book_id: "book6", timestamp: DateTime.add(one_month_ago, -5, :day)},
      ]
      
      result = Analytics.calculate_popular_books(checkout_data, time_period)
      
      # Expected result: book1 has 3 checkouts, book2 has 2, the rest have 1 each
      assert result == [
        {"book1", 3},
        {"book2", 2}, 
        {"book3", 1},
        {"book4", 1},
        {"book5", 1}
      ]
    end
    
    test "handles empty checkout data" do
      now = DateTime.utc_now()
      one_month_ago = DateTime.add(now, -30, :day)
      time_period = %{start: one_month_ago, end: now}
      
      assert [] = Analytics.calculate_popular_books([], time_period)
    end
    
    test "returns fewer than 10 books when there are fewer than 10 unique books" do
      now = DateTime.utc_now()
      one_month_ago = DateTime.add(now, -30, :day)
      time_period = %{start: one_month_ago, end: now}
      
      checkout_data = [
        %{book_id: "book1", timestamp: DateTime.add(now, -5, :day)},
        %{book_id: "book2", timestamp: DateTime.add(now, -7, :day)},
      ]
      
      result = Analytics.calculate_popular_books(checkout_data, time_period)
      assert length(result) == 2
    end
  end
end