using System;

namespace SongGuesser.Api.Models
{
    public class Song //Data model representing a song in the database
    {
        public int Uid { get; set; }
        public string Creator { get; set; } = "";
        public string Title { get; set; } = "";
        public string YouTubeId { get; set; } = "";
        public int StartSeconds { get; set; }
    }
}