const express=require("express");
const cors=require("cors");
const {Pool}=require("pg");

const app=express();

const PORT=process.env.PORT||3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pool=new Pool({
    connectionString:process.env.DATABASE_URL,
    ssl:{
        rejectUnauthorized:false
    }
});

const MAX_MESSAGES=1000;


// Create database table
async function setupDatabase(){

    await pool.query(`
        CREATE TABLE IF NOT EXISTS announcements(
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Database ready");
}


// Home / health check
app.get("/",(req,res)=>{
    res.send("Roblox message HTTP server online");
});


// Roblox polls this endpoint
app.get("/announcement",async(req,res)=>{

    try{

        const result=await pool.query(`
            DELETE FROM announcements
            WHERE id=(
                SELECT id
                FROM announcements
                ORDER BY id ASC
                LIMIT 1
            )
            RETURNING message
        `);

        const message=
            result.rows.length>0
            ?result.rows[0].message
            :null;

        const countResult=await pool.query(`
            SELECT COUNT(*) FROM announcements
        `);

        res.json({
            message:message,
            messagesLeft:Number(countResult.rows[0].count)
        });

    }catch(err){

        console.error("Error getting announcement:",err);

        res.status(500).json({
            message:null,
            error:"Database error"
        });

    }

});


// Website sends a message
app.post("/announcement",async(req,res)=>{

    const message=req.body?.message;

    if(
        typeof message!=="string"||
        message.trim()===""
    ){

        return res.status(400).json({
            success:false,
            error:"Message is required"
        });

    }

    try{

        const result=await pool.query(`
            INSERT INTO announcements(message)
            VALUES($1)
            RETURNING id
        `,[message.trim()]);

        // Keep only the newest MAX_MESSAGES
        await pool.query(`
            DELETE FROM announcements
            WHERE id IN(
                SELECT id
                FROM announcements
                ORDER BY id ASC
                OFFSET $1
            )
        `,[MAX_MESSAGES]);

        const countResult=await pool.query(`
            SELECT COUNT(*) FROM announcements
        `);

        const count=Number(countResult.rows[0].count);

        console.log("Announcement received:",message);
        console.log("Messages waiting:",count);

        res.json({
            success:true,
            id:result.rows[0].id,
            messagesWaiting:count
        });

    }catch(err){

        console.error("Error saving announcement:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// View queued messages
app.get("/messages",async(req,res)=>{

    try{

        const result=await pool.query(`
            SELECT
                id,
                message,
                created_at
            FROM announcements
            ORDER BY id ASC
        `);

        res.json({
            count:result.rows.length,
            messages:result.rows
        });

    }catch(err){

        console.error("Error getting messages:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// Clear queue
app.delete("/messages",async(req,res)=>{

    try{

        await pool.query(`
            DELETE FROM announcements
        `);

        console.log("Message queue cleared");

        res.json({
            success:true
        });

    }catch(err){

        console.error("Error clearing messages:",err);

        res.status(500).json({
            success:false,
            error:"Database error"
        });

    }

});


// Test route
app.get("/test",(req,res)=>{
    res.send("Test route works");
});


// Start server
setupDatabase()
    .then(()=>{

        app.listen(PORT,"0.0.0.0",()=>{
            console.log(
                `Roblox message HTTP server running on port ${PORT}`
            );
        });

    })
    .catch(err=>{

        console.error(
            "Failed to start database:",
            err
        );

    });
